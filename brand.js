const express = require("express");
const router = express.Router();
const { pool } = require("../db/db.js"); 

router.get("/get-brands", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM brands ORDER BY id ASC");
    res.json({ brands: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/add-brand", async (req, res) => {
  const { brandName } = req.body;
  if (!brandName) return res.status(400).json({ message: "brandName is required" });

  try {
    const result = await pool.query(
      "INSERT INTO brands (brandName) VALUES ($1) RETURNING *",
      [brandName]
    );
    res.json({ message: "Brand added successfully", brandName: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/update-brand/:id", async (req, res) => {
  const { id } = req.params;
  const { brandName } = req.body;

  try {
    const result = await pool.query(
      "UPDATE brands SET brandName=$1 WHERE id=$2 RETURNING *",
      [brandName, id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ message: "Brand not found" });

    res.json({ message: "Brand updated successfully", brand: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/delete-brand/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "DELETE FROM brands WHERE id=$1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ message: "Brand not found" });

    res.json({ message: "Brand deleted successfully", brand: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
