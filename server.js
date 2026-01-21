// login

const { pool } = require("./db.js");

pool
  .query("SELECT NOW()")
  .then((res) => {})
  .catch((err) => {
    console.error("Error", err);
  });

const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const multer = require("multer");
const bcrypt = require("bcryptjs");

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "5000kb" }));

const JWT_SECRET = "SUPER_SECRET_KEY";

app.listen(3000, () => {
  console.log("http://localhost:3000");
});

// brands
const brandsRoutes = require("./brand.js");
app.use("/Brands", brandsRoutes);

//category
const categoriesRoutes = require("./categories");
app.use("/Category", categoriesRoutes);

// products
const safeJson = (value) => {
  try {
    if (!value) return [];
    if (typeof value === "object") return value;
    return JSON.parse(value);
  } catch {
    return [];
  }
};

const upload = multer({
  limits: { fieldSize: 10 * 1024 * 1024 },
});
app.post("/product/add-product", upload.none(), async (req, res) => {
  try {
    const {
      productName,
      description,
      category,
      brand,
      price,
      count,
      disCount,
      code,
      colors,
      images,
    } = req.body;

    const parsedColors = safeJson(colors);
    const parsedImages = safeJson(images);

    const result = await pool.query(
      `
      INSERT INTO products
      (id, product_name, description, category, brand, price, count, discount, code, colors, images)
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb)
      RETURNING *
      `,
      [
        Date.now(),
        productName,
        description || "no description",
        category,
        brand,
        Number(price),
        Number(count),
        Number(disCount),
        code,
        JSON.stringify(parsedColors),
        JSON.stringify(parsedImages),
      ],
    );

    res.status(201).json({
      message: "Product added successfully",
      product: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to add product", error });
  }
});
app.get("/product/get-products", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        product_name AS "productName",
        description,
        category,
        brand,
        price,
        count,
        discount AS "disCount",
        code,
        view,
        colors,
        images,
        date
      FROM products
    `);

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

app.delete("/product/delete-product/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const result = await pool.query(
      "DELETE FROM products WHERE id = $1 RETURNING *",
      [id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({
      message: "Product deleted successfully",
      product: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to delete product" });
  }
});

app.put("/product/update-product/:id", upload.none(), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      productName,
      description,
      category,
      brand,
      price,
      count,
      disCount,
      code,
      colors,
      images,
    } = req.body;
    const existing = await pool.query(
      "SELECT colors, images FROM products WHERE id = $1",
      [id],
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "Product not found" });
    }
    const finalColors =
      colors !== undefined ? safeJson(colors) : existing.rows[0].colors;
    const finalImages =
      images !== undefined ? safeJson(images) : existing.rows[0].images;
    const result = await pool.query(
      `
      UPDATE products SET
        product_name = $1,
        description = $2,
        category = $3,
        brand = $4,
        price = $5,
        count = $6,
        discount = $7,
        code = $8,
        colors = $9::jsonb,
        images = $10::jsonb
      WHERE id = $11
      RETURNING *
      `,
      [
        productName,
        description,
        category,
        brand,
        Number(price),
        Number(count),
        Number(disCount),
        code,
        JSON.stringify(finalColors),
        JSON.stringify(finalImages),
        id,
      ],
    );

    res.json({
      message: "Product updated successfully",
      product: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update product" });
  }
});

//login user
app.post("/Account/register/user", async (req, res) => {
  const { userName, email, password } = req.body;
  const existUser = await pool.query("SELECT * FROM users WHERE email=$1", [
    email,
  ]);
  if (existUser.rowCount > 0)
    return res.status(400).json({ message: "Email already exists" });
  const hashedPassword = await bcrypt.hash(password, 10);
  const newUserId = Date.now();
  const result = await pool.query(
    `
    INSERT INTO users (user_id, user_name, email, password, profile)
    VALUES ($1,$2,$3,$4,$5)
    RETURNING *
    `,
    [
      newUserId,
      userName,
      email,
      hashedPassword,
      JSON.stringify({ id: 1, image: "" }),
    ],
  );
  const newUser = result.rows[0];
  const token = jwt.sign(
    { userId: newUser.user_id, email: newUser.email },
    JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );

  res.json({
    token,
    user: {
      userId: newUser.user_id,
      userName: newUser.user_name,
      email: newUser.email,
      profile: newUser.profile,
    },
  });
});

app.post("/Account/login/user", async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query("SELECT * FROM users WHERE email=$1", [
    email,
  ]);
  if (result.rowCount === 0)
    return res.status(401).json({ message: "User not found" });
  const user = result.rows[0];
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) return res.status(401).json({ message: "Invalid password" });
  const token = jwt.sign(
    { userId: user.user_id, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
  res.json({
    token,
    user: {
      userId: user.user_id,
      userName: user.user_name,
      email: user.email,
      profile: user.profile,
    },
  });
});

app.get("/Account/get-account-user", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ message: "No token provided" });
  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Invalid token format" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await pool.query("SELECT * FROM users WHERE user_id=$1", [
      decoded.userId,
    ]);
    if (result.rowCount === 0)
      return res.status(404).json({ message: "User not found" });
    const user = result.rows[0];
    res.json({
      userId: user.user_id,
      userName: user.user_name,
      email: user.email,
      profile: user.profile,
    });
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
});

app.put("/Account/change-account-user", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ message: "No token provided" });
  const token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Invalid token format" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await pool.query("SELECT * FROM users WHERE user_id=$1", [
      decoded.userId,
    ]);
    if (result.rowCount === 0)
      return res.status(404).json({ message: "User not found" });
    const user = result.rows[0];
    const { userName, image } = req.body;
    const newProfile = image ? { ...user.profile, image } : user.profile;
    const newName = userName || user.user_name;
    const update = await pool.query(
      `UPDATE users SET user_name=$1, profile=$2 WHERE user_id=$3 RETURNING *`,
      [newName, JSON.stringify(newProfile), user.user_id],
    );
    const updatedUser = update.rows[0];
    res.json({
      userId: updatedUser.user_id,
      userName: updatedUser.user_name,
      email: updatedUser.email,
      profile: updatedUser.profile,
    });
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: "Invalid token" });
  }
});

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ message: "No token provided" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

app.get("/product/get-product-by-id/:id", async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const result = await pool.query("SELECT * FROM products WHERE id=$1", [
      productId,
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    const product = result.rows[0];

    // Агар токен дошта бошад, view-ро навсозӣ кун
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(" ")[1];
        if (token) {
          const decoded = jwt.verify(token, JWT_SECRET);
          let views = product.view || [];
          const alreadyViewed = views.find((v) => v.userId === decoded.userId);

          if (!alreadyViewed) {
            views.push({
              userId: decoded.userId,
              email: decoded.email,
              date: new Date(),
            });
            await pool.query("UPDATE products SET view=$1 WHERE id=$2", [
              JSON.stringify(views),
              productId,
            ]);
            product.view = views;
          }
        }
      } catch (err) {}
    }
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

// cart
app.get("/Cart/get-products-from-cart", authMiddleware, async (req, res) => {
  const result = await pool.query(
    `SELECT c.cart_item_id, c.quantity, p.* 
     FROM cart c 
     JOIN products p ON c.product_id = p.id 
     WHERE c.user_id = $1`,
    [req.user.userId],
  );

  res.json(
    result.rows.map((row) => ({
      cartItemId: row.cart_item_id,
      quantity: row.quantity,
      product: {
        id: row.id,
        productName: row.product_name,
        description: row.description,
        category: row.category,
        brand: row.brand,
        price: row.price,
        count: row.count,
        disCount: row.discount,
        code: row.code,
        view: row.view,
        colors: row.colors,
        images: row.images,
        date: row.date,
      },
    })),
  );
});
app.post("/Cart/add-product-to-cart/:id", authMiddleware, async (req, res) => {
  const productId = Number(req.params.id);

  const productResult = await pool.query("SELECT * FROM products WHERE id=$1", [
    productId,
  ]);
  if (productResult.rowCount === 0)
    return res.status(404).json({ message: "Product not found" });

  const cartResult = await pool.query(
    "SELECT * FROM cart WHERE user_id=$1 AND product_id=$2",
    [req.user.userId, productId],
  );

  if (cartResult.rowCount > 0) {
    const cartItemId = cartResult.rows[0].cart_item_id;
    await pool.query(
      "UPDATE cart SET quantity=quantity+1 WHERE cart_item_id=$1",
      [cartItemId],
    );
    return res.json({ message: "Quantity increased" });
  }

  const newCartItemId = Date.now() + Math.floor(Math.random() * 1000);
  await pool.query(
    "INSERT INTO cart (cart_item_id, user_id, product_id, quantity) VALUES ($1,$2,$3,$4)",
    [newCartItemId, req.user.userId, productId, 1],
  );

  res.json({ message: "Product added in cart" });
});
app.post(
  "/Cart/decrease-product-in-cart/:id",
  authMiddleware,
  async (req, res) => {
    const productId = Number(req.params.id);

    const cartResult = await pool.query(
      "SELECT * FROM cart WHERE user_id=$1 AND product_id=$2",
      [req.user.userId, productId],
    );

    if (cartResult.rowCount === 0)
      return res.status(404).json({ message: "Product not found in cart" });

    const cartItem = cartResult.rows[0];

    if (cartItem.quantity <= 1) {
      await pool.query("DELETE FROM cart WHERE cart_item_id=$1", [
        cartItem.cart_item_id,
      ]);
      return res.json({ message: "Product removed from cart" });
    }

    await pool.query(
      "UPDATE cart SET quantity=quantity-1 WHERE cart_item_id=$1",
      [cartItem.cart_item_id],
    );

    res.json({ message: "Quantity decreased" });
  },
);
app.delete(
  "/Cart/delete-product-from-cart/:id",
  authMiddleware,
  async (req, res) => {
    const productId = Number(req.params.id);

    const result = await pool.query(
      "DELETE FROM cart WHERE user_id=$1 AND product_id=$2 RETURNING *",
      [req.user.userId, productId],
    );

    if (result.rowCount === 0)
      return res.status(404).json({ message: "Product not found in cart" });

    res.json({ message: "Product deleted successfully" });
  },
);
app.post("/Cart/clear-cart", authMiddleware, async (req, res) => {
  await pool.query("DELETE FROM cart WHERE user_id=$1", [req.user.userId]);
  res.json({ message: "Cart cleared" });
});

// order
app.post("/order/add-order", authMiddleware, async (req, res) => {
  const { name, surName, phone, address, message, total, order_user } =
    req.body;
  if (!order_user || order_user.length === 0) {
    return res.status(400).json({ message: "Order items are required" });
  }
  const existing = await pool.query("SELECT * FROM orders WHERE user_id=$1", [
    req.user.userId,
  ]);
  if (existing.rowCount > 0) {
    const updated = await pool.query(
      `UPDATE orders
       SET order_user=$1, total=$2, date_of_order=NOW(), name=$3, sur_name=$4, phone=$5, address=$6, message=$7
       WHERE user_id=$8
       RETURNING *`,
      [
        JSON.stringify(order_user),
        total,
        name,
        surName,
        phone,
        address,
        message,
        req.user.userId,
      ],
    );
    return res
      .status(200)
      .json({ message: "Order updated successfully", order: updated.rows[0] });
  }

  const orderId = Date.now() + Math.floor(Math.random() * 1000);
  const result = await pool.query(
    `INSERT INTO orders (order_id, user_id, name, sur_name, phone, address, message, total, order_user)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      orderId,
      req.user.userId,
      name,
      surName,
      phone,
      address,
      message,
      total,
      JSON.stringify(order_user),
    ],
  );

  res
    .status(201)
    .json({ message: "Order added successfully", order: result.rows[0] });
});
app.get("/order/get-order-products", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM orders ORDER BY date_of_order DESC",
    );
    res.json(
      result.rows.map((order) => ({
        userId: order.user_id,
        name: order.name,
        surName: order.sur_name,
        phone: order.phone,
        address: order.address,
        message: order.message,
        total: order.total,
        date_of_order: order.date_of_order,
        order_user: order.order_user,
      })),
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch all orders" });
  }
});

app.delete("/order/delete-order/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await pool.query("SELECT * FROM orders WHERE user_id=$1", [
      id,
    ]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "Order not found" });
    }
    await pool.query("DELETE FROM orders WHERE user_id=$1", [id]);
    res.status(200).json({ message: "Order deleted successfully", id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete order" });
  }
});

// admin
const admins = [
  {
    id: 1,
    userName: "Yusuf-Dodarov",
    password: "Dodarov-09*",
    role: "admin",
  },
];

app.post("/Account/login/admin", (req, res) => {
  const { userName, password } = req.body;
  if (!userName || !password) {
    return res.status(400).json({ message: "Missing data" });
  }
  const admin = admins.find(
    (a) => a.userName === userName && a.password === password,
  );
  if (!admin) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  const token = jwt.sign({ id: admin.id, role: admin.role }, JWT_SECRET, {
    expiresIn: "1h",
  });
  res.json({ token });
});

// order
