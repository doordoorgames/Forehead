import { Router } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { categoriesTable, categoryItemsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { insertCharacters, listAllCharacters, deleteCharacter } from "../lib/characterPool";
import {
  AdminListCategoriesHeader,
  AdminListCategoriesResponseItem,
  AdminCreateCategoryHeader,
  AdminCreateCategoryBody,
  AdminUpdateCategoryParams,
  AdminUpdateCategoryHeader,
  AdminUpdateCategoryBody,
  AdminDeleteCategoryParams,
  AdminDeleteCategoryHeader,
  AdminListItemsParams,
  AdminListItemsHeader,
  AdminUploadItemsParams,
  AdminUploadItemsHeader,
  AdminVerifyBody,
} from "@workspace/api-zod";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

function checkAdminPassword(password: string | undefined): boolean {
  return password === ADMIN_PASSWORD;
}

function buildCategoryResponse(cat: { id: number; name: string; description: string | null; type: string; enabled: boolean; createdAt: Date }, itemCount: number) {
  return AdminListCategoriesResponseItem.parse({
    id: cat.id,
    name: cat.name,
    description: cat.description ?? undefined,
    type: cat.type,
    enabled: cat.enabled,
    itemCount,
    createdAt: cat.createdAt.toISOString(),
  });
}

// POST /api/admin/verify
router.post("/admin/verify", async (req, res) => {
  const body = AdminVerifyBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  res.json({ valid: checkAdminPassword(body.data.password) });
});

// GET /api/admin/categories
router.get("/admin/categories", async (req, res) => {
  const headers = AdminListCategoriesHeader.safeParse({
    "x-admin-password": req.headers["x-admin-password"],
  });
  if (!headers.success || !checkAdminPassword(headers.data["x-admin-password"])) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const categories = await db.select().from(categoriesTable);
  const result = await Promise.all(
    categories.map(async (cat) => {
      const [{ value }] = await db.select({ value: count() }).from(categoryItemsTable).where(eq(categoryItemsTable.categoryId, cat.id));
      return buildCategoryResponse(cat, Number(value));
    })
  );
  res.json(result);
});

// POST /api/admin/categories
router.post("/admin/categories", async (req, res) => {
  const headers = AdminCreateCategoryHeader.safeParse({ "x-admin-password": req.headers["x-admin-password"] });
  if (!headers.success || !checkAdminPassword(headers.data["x-admin-password"])) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const body = AdminCreateCategoryBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const [cat] = await db.insert(categoriesTable).values({
    name: body.data.name,
    description: body.data.description ?? null,
    type: body.data.type,
    enabled: body.data.enabled ?? true,
  }).returning();
  res.status(201).json(buildCategoryResponse(cat, 0));
});

// PUT /api/admin/categories/:id
router.put("/admin/categories/:id", async (req, res) => {
  const params = AdminUpdateCategoryParams.safeParse({ id: Number(req.params.id) });
  const headers = AdminUpdateCategoryHeader.safeParse({ "x-admin-password": req.headers["x-admin-password"] });
  if (!headers.success || !checkAdminPassword(headers.data["x-admin-password"])) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!params.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const body = AdminUpdateCategoryBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (body.data.name !== undefined) updates.name = body.data.name;
  if (body.data.description !== undefined) updates.description = body.data.description;
  if (body.data.type !== undefined) updates.type = body.data.type;
  if (body.data.enabled !== undefined) updates.enabled = body.data.enabled;

  const [cat] = await db.update(categoriesTable).set(updates).where(eq(categoriesTable.id, params.data.id)).returning();
  if (!cat) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [{ value }] = await db.select({ value: count() }).from(categoryItemsTable).where(eq(categoryItemsTable.categoryId, cat.id));
  res.json(buildCategoryResponse(cat, Number(value)));
});

// DELETE /api/admin/categories/:id
router.delete("/admin/categories/:id", async (req, res) => {
  const params = AdminDeleteCategoryParams.safeParse({ id: Number(req.params.id) });
  const headers = AdminDeleteCategoryHeader.safeParse({ "x-admin-password": req.headers["x-admin-password"] });
  if (!headers.success || !checkAdminPassword(headers.data["x-admin-password"])) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!params.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const [cat] = await db.delete(categoriesTable).where(eq(categoriesTable.id, params.data.id)).returning();
  if (!cat) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ success: true });
});

// GET /api/admin/categories/:id/items
router.get("/admin/categories/:id/items", async (req, res) => {
  const params = AdminListItemsParams.safeParse({ id: Number(req.params.id) });
  const headers = AdminListItemsHeader.safeParse({ "x-admin-password": req.headers["x-admin-password"] });
  if (!headers.success || !checkAdminPassword(headers.data["x-admin-password"])) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!params.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }
  const items = await db.select().from(categoryItemsTable).where(eq(categoryItemsTable.categoryId, params.data.id));
  res.json(items.map((item) => ({
    id: item.id,
    categoryId: item.categoryId,
    itemText: item.itemText,
    imageUrl: item.imageUrl ?? null,
    createdAt: item.createdAt.toISOString(),
  })));
});

// POST /api/admin/categories/:id/upload
router.post("/admin/categories/:id/upload", upload.single("file"), async (req, res) => {
  const params = AdminUploadItemsParams.safeParse({ id: Number(req.params.id) });
  const headers = AdminUploadItemsHeader.safeParse({ "x-admin-password": req.headers["x-admin-password"] });
  if (!headers.success || !checkAdminPassword(headers.data["x-admin-password"])) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!params.success) {
    res.status(400).json({ error: "Invalid params" });
    return;
  }

  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const errors: string[] = [];
  const rows: Array<{ itemText: string; imageUrl?: string }> = [];

  try {
    const ext = file.originalname.toLowerCase().split(".").pop();
    if (ext === "csv") {
      const text = file.buffer.toString("utf-8");
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/^"(.*)"$/, "$1"));
      const itemTextIdx = header.indexOf("item_text");
      const imageUrlIdx = header.indexOf("image_url");
      if (itemTextIdx === -1) {
        res.status(400).json({ error: "CSV must have an 'item_text' column" });
        return;
      }
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim().replace(/^"(.*)"$/, "$1"));
        const itemText = cols[itemTextIdx];
        if (!itemText) {
          errors.push(`Row ${i + 1}: empty item_text`);
          continue;
        }
        rows.push({ itemText, imageUrl: imageUrlIdx !== -1 ? cols[imageUrlIdx] || undefined : undefined });
      }
    } else if (ext === "xlsx" || ext === "xls") {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(file.buffer, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const itemText = (row["item_text"] || row["Item Text"] || row["ItemText"] || "").trim();
        const imageUrl = (row["image_url"] || row["Image URL"] || row["ImageUrl"] || "").trim();
        if (!itemText) {
          errors.push(`Row ${i + 2}: empty item_text`);
          continue;
        }
        rows.push({ itemText, imageUrl: imageUrl || undefined });
      }
    } else {
      res.status(400).json({ error: "Only CSV and XLSX files are supported" });
      return;
    }
  } catch (err) {
    req.log.error({ err }, "Error parsing upload");
    res.status(400).json({ error: "Failed to parse file" });
    return;
  }

  // Delete existing items and replace
  await db.delete(categoryItemsTable).where(eq(categoryItemsTable.categoryId, params.data.id));

  let imported = 0;
  for (const row of rows) {
    await db.insert(categoryItemsTable).values({
      categoryId: params.data.id,
      itemText: row.itemText,
      imageUrl: row.imageUrl ?? null,
    });
    imported++;
  }

  res.json({ imported, skipped: errors.length, errors, replaced: true });
});

// POST /api/admin/upload-master
// Accepts one CSV/XLSX where each COLUMN is a category.
// Row 1 (header) = category name. Rows 2+ = items for that category.
router.post("/admin/upload-master", upload.single("file"), async (req, res) => {
  const password = req.headers["x-admin-password"] as string | undefined;
  if (!checkAdminPassword(password)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  // columns[i] = { name: string, items: string[] }
  const columns: Array<{ name: string; items: string[] }> = [];

  try {
    const ext = file.originalname.toLowerCase().split(".").pop();
    if (ext === "csv") {
      const text = file.buffer.toString("utf-8");
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 1) {
        res.status(400).json({ error: "File is empty" });
        return;
      }
      // Simple CSV splitter that handles quoted fields
      const splitCsvLine = (line: string): string[] => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        for (const ch of line) {
          if (ch === '"') { inQuotes = !inQuotes; continue; }
          if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; continue; }
          current += ch;
        }
        result.push(current.trim());
        return result;
      };
      const headers = splitCsvLine(lines[0]).map((h) => h.replace(/^"(.*)"$/, "$1").trim());
      headers.forEach((name, colIdx) => {
        if (!name) return;
        const items: string[] = [];
        for (let row = 1; row < lines.length; row++) {
          const cells = splitCsvLine(lines[row]);
          const val = (cells[colIdx] || "").trim();
          if (val) items.push(val);
        }
        columns.push({ name, items });
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(file.buffer, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      // Use sheet_to_json with header:1 to get rows as arrays
      const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" }) as string[][];
      if (rows.length < 1) {
        res.status(400).json({ error: "File is empty" });
        return;
      }
      const headerRow = rows[0];
      headerRow.forEach((name, colIdx) => {
        const trimmedName = String(name).trim();
        if (!trimmedName) return;
        const items: string[] = [];
        for (let row = 1; row < rows.length; row++) {
          const val = String(rows[row][colIdx] || "").trim();
          if (val) items.push(val);
        }
        columns.push({ name: trimmedName, items });
      });
    } else {
      res.status(400).json({ error: "Only CSV and XLSX files are supported" });
      return;
    }
  } catch (err) {
    req.log.error({ err }, "Error parsing master upload");
    res.status(400).json({ error: "Failed to parse file" });
    return;
  }

  if (columns.length === 0) {
    res.status(400).json({ error: "No columns found in file" });
    return;
  }

  // lang tag: 'en' | 'ar' — stored in the type column
  const lang = (req.query.lang as string) === "ar" ? "ar" : "en";

  // Upsert each column as a category and replace its items
  const results: Array<{ name: string; itemCount: number; created: boolean }> = [];
  for (const col of columns) {
    // Find existing category by name (case-insensitive) AND same language
    const allCats = await db.select().from(categoriesTable);
    let cat = allCats.find(
      (c) => c.name.toLowerCase() === col.name.toLowerCase() && c.type === lang
    ) ?? null;

    if (!cat) {
      const [newCat] = await db.insert(categoriesTable).values({
        name: col.name,
        type: lang,
        enabled: true,
      }).returning();
      cat = newCat;
      results.push({ name: col.name, itemCount: col.items.length, created: true });
    } else {
      results.push({ name: col.name, itemCount: col.items.length, created: false });
    }

    // Replace all items
    await db.delete(categoryItemsTable).where(eq(categoryItemsTable.categoryId, cat.id));
    for (const item of col.items) {
      await db.insert(categoryItemsTable).values({ categoryId: cat.id, itemText: item, imageUrl: null });
    }
  }

  res.json({ categories: results, totalCategories: results.length, errors: [], lang });
});

// POST /api/admin/upload-characters?lang=en|ar
// CSV: Column A = answer, Columns B-K = hint1..hint10
router.post("/admin/upload-characters", upload.single("file"), async (req, res) => {
  const password = req.headers["x-admin-password"] as string | undefined;
  if (!checkAdminPassword(password)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const lang = (req.query.lang as string) || (req.body?.lang as string) || "en";
  if (lang !== "en" && lang !== "ar") {
    res.status(400).json({ error: "lang must be 'en' or 'ar'" });
    return;
  }

  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const entries: Array<{ answer: string; hints: string[]; lang: string }> = [];
  const errors: string[] = [];

  try {
    const ext = file.originalname.toLowerCase().split(".").pop();
    let rows: string[][] = [];

    if (ext === "csv") {
      const text = file.buffer.toString("utf-8");
      const lines = text.split(/\r?\n/);
      const splitCsvLine = (line: string): string[] => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        for (const ch of line) {
          if (ch === '"') { inQuotes = !inQuotes; continue; }
          if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; continue; }
          current += ch;
        }
        result.push(current.trim());
        return result;
      };
      rows = lines.map((l) => splitCsvLine(l));
    } else if (ext === "xlsx" || ext === "xls") {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(file.buffer, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" }) as string[][];
    } else {
      res.status(400).json({ error: "Only CSV and XLSX files are supported" });
      return;
    }

    // Skip header row if first cell looks like a label
    let startRow = 0;
    if (rows.length > 0) {
      const firstCell = String(rows[0][0] ?? "").toLowerCase().trim();
      if (firstCell === "answer" || firstCell === "character" || firstCell === "") {
        startRow = 1;
      }
    }

    for (let i = startRow; i < rows.length; i++) {
      const cols = rows[i].map((c) => String(c ?? "").trim());
      const answer = cols[0] ?? "";
      if (!answer) continue;

      const hints = cols.slice(1, 11).filter((h) => h.length > 0);
      if (hints.length === 0) {
        errors.push(`Row ${i + 1}: "${answer}" has no hints — skipped`);
        continue;
      }
      entries.push({ answer, hints, lang });
    }

    if (entries.length === 0) {
      res.status(400).json({ error: "No valid rows found. Each row needs an answer and at least one hint.", errors });
      return;
    }

    await insertCharacters(entries);
    res.json({ imported: entries.length, skipped: errors.length, errors, lang });
  } catch (err) {
    req.log.error({ err }, "Error parsing character upload");
    res.status(400).json({ error: "Failed to parse file" });
  }
});

// GET /api/admin/characters?lang=en|ar  (optional lang filter)
router.get("/admin/characters", async (req, res) => {
  const password = req.headers["x-admin-password"] as string | undefined;
  if (!checkAdminPassword(password)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const lang = req.query.lang as string | undefined;
  const chars = await listAllCharacters(lang);
  res.json(chars);
});

// DELETE /api/admin/characters/:id
router.delete("/admin/characters/:id", async (req, res) => {
  const password = req.headers["x-admin-password"] as string | undefined;
  if (!checkAdminPassword(password)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await deleteCharacter(id);
  res.json({ ok: true });
});

export default router;
