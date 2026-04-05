import { Router } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { categoriesTable, categoryItemsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
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

export default router;
