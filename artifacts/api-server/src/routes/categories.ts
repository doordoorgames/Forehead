import { Router } from "express";
import { db } from "@workspace/db";
import { categoriesTable, categoryItemsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import {
  ListCategoriesResponseItem,
} from "@workspace/api-zod";

const router = Router();

// GET /api/categories - list enabled categories with item counts
router.get("/categories", async (req, res) => {
  try {
    const categories = await db.select().from(categoriesTable).where(eq(categoriesTable.enabled, true));
    const result = await Promise.all(
      categories.map(async (cat) => {
        const [{ value }] = await db
          .select({ value: count() })
          .from(categoryItemsTable)
          .where(eq(categoryItemsTable.categoryId, cat.id));
        return ListCategoriesResponseItem.parse({
          id: cat.id,
          name: cat.name,
          description: cat.description ?? undefined,
          type: cat.type,
          enabled: cat.enabled,
          itemCount: Number(value),
          createdAt: cat.createdAt.toISOString(),
        });
      })
    );
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error listing categories");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
