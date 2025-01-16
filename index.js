const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

// app.use(
//   cors({
//     origin: "https://visapilot.netlify.app", // Specify your frontend domain here
//     methods: ["GET", "POST", "PUT", "DELETE"], // Adjust methods as needed
//     allowedHeaders: ["Content-Type"], // You can add more headers if needed
//   })
// );

app.use(
  cors({
    origin: ["https://recidencehotel.netlify.app", "http://localhost:5173" ],
    credentials: true,
  })
);

app.use(express.json());
// app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.3tilc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {

    const usersPH = client.db("productHuntDB").collection("users");
    const productsPH = client.db("productHuntDB").collection("products");




// Route to register user or check existence
app.post("/register", async (req, res) => {
  try {
    const { email, name, photo } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if user already exists
    const existingUser = await usersPH.findOne({ email: email });

    if (existingUser) {
      // User already exists, return success with existing user details
      return res.status(200).json({
        message: "User already exists",
        user: existingUser,
      });
    }

    // Create a new user object
    const newUser = {
      email: email,
      name: name || "Unnamed User", // Default to "Unnamed User" if no name provided
      photo: photo || null,
      role: "user", // Default role
      createdAt: new Date(), // Registration time
    };

    // Insert user into the collection
    const result = await usersPH.insertOne(newUser);

    if (result.insertedId) {
      res.status(201).json({
        message: "User registered successfully",
        user: newUser,
      });
    } else {
      res.status(500).json({ message: "Failed to register user" });
    }
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

//check if moderator 
app.post("/api/check-role", async (req, res) => {
  const { email } = req.body;

  if (!email) {
      return res.status(400).json({ error: "Email is required" });
  }

  try {
      const user = await usersPH.findOne({ email });

      if (user) {
          res.status(200).json({ role: user.role });
      } else {
          res.status(404).json({ error: "User not found" });
      }
  } catch (error) {
      console.error("Error checking user role:", error);
      res.status(500).json({ error: "Internal Server Error" });
  }
});






// Fetch products by status
app.get("/api/products", async (req, res) => {
  const { status } = req.query;

  try {
      // Query to filter by status if provided
      const query = status ? { status } : {};

      // Fetch products based on query
      const products = await productsPH.find(query).toArray();

      res.status(200).json(products);
  } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Internal Server Error" });
  }
});






// Update product status (approve or reject)
app.patch("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.query;

  if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
  }

  try {
      const result = await productsPH.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status } }
      );

      if (result.modifiedCount > 0) {
          res.status(200).json({ message: `Product ${status} successfully` });
      } else {
          res.status(404).json({ error: "Product not found" });
      }
  } catch (error) {
      console.error("Error updating product status:", error);
      res.status(500).json({ error: "Internal Server Error" });
  }
});




// Add  products
app.post("/products", async (req, res) => {
  try {
    const product = req.body;

    // Validate product data (optional)
    if (!product.name || !product.description || !product.price || !product.image) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Set initial status to "pending"
    const productWithStatus = {
      ...product,
      status: "pending",
      createdAt: new Date(), // Add a timestamp for product creation
    };

    // Insert product into the collection
    const result = await productsPH.insertOne(productWithStatus);

    if (result.insertedId) {
      res.status(201).json({ message: "Product added successfully" });
    } else {
      res.status(500).json({ message: "Failed to add product" });
    }
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});




//get my products

app.get('/my-products', async (req, res) => {
  try {
    const { email } = req.query; // Get email from query parameters

    if (!email) {
      return res.status(400).json({ message: "User email is required" });
    }

    const products = await productsPH.find({ creatorEmail: email }).toArray();

    res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});



//get all products with pagination
app.get('/products', async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Current page number
  const limit = parseInt(req.query.limit) || 6; // Items per page
  const skip = (page - 1) * limit; // Items to skip

  try {
    const totalProducts = await productsPH.countDocuments(); // Total number of products
    const products = await productsPH.find().sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(); // Fetch paginated products

    res.status(200).json({
      products,
      currentPage: page,
      totalPages: Math.ceil(totalProducts / limit),
    });
  } catch (error) {
    res.status(500).json({ error: 'Error fetching products' });
  }
});



 // Get product by ID
 app.get("/products/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const product = await productsPH.findOne({ _id: new ObjectId(id) });

    if (product) {
      res.send(product);
    } else {
      res.status(404).send({ message: "product not found" });
    }
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).send({ message: "Server error" });
  }
});











































































    //insert a visa
    app.post("/add-visa", async (req, res) => {
      const newVisa = req.body;
      console.log("New visa:", newVisa);

      const result = await visaCollection.insertOne(newVisa);
      res.send(result);
    });

    // API Endpoint to Get All Visas with Optional Limit
    app.get("/visas", async (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 0; // Default to 0 (no limit) if not provided
        const visas = await visaCollection
          .find()
          .sort({ createdAt: -1 })
          .limit(limit)
          .toArray(); // Sort by createdAt, then apply limit
        res.send(visas);
      } catch (error) {
        console.error("Failed to fetch visas:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // fetching visas by authorEmail
    app.get("/my-visas", async (req, res) => {
      const email = req.query.email;
      try {
        const myVisas = await visaCollection
          .find({ authorEmail: email })
          .toArray();
        res.send(myVisas);
      } catch (error) {
        console.error("Failed to fetch visas:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // Update a visa by ID
    app.put("/visas/:id", async (req, res) => {
      const id = req.params.id;
      const updatedVisa = req.body;

      try {
        const result = await visaCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedVisa }
        );

        if (result.modifiedCount > 0) {
          res.send({ message: "Visa updated successfully!" });
        } else {
          res
            .status(404)
            .send({ message: "Visa not found or no changes made." });
        }
      } catch (error) {
        console.error("Error updating visa:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // Delete a visa by ID
    app.delete("/visas/:id", async (req, res) => {
      const id = req.params.id; // Extract the visa ID from the route parameter

      try {
        const result = await visaCollection.deleteOne({
          _id: new ObjectId(id),
        }); // Match visa by ID

        if (result.deletedCount > 0) {
          res.send({ message: "Visa deleted successfully!" });
        } else {
          res.status(404).send({ message: "Visa not found." });
        }
      } catch (error) {
        console.error("Error deleting visa:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

   

    // save visa application
    app.post("/applications", async (req, res) => {
      const application = req.body;

      try {
        const result = await applicationCollection.insertOne(application);
        res.send(result);
      } catch (error) {
        console.error("Error saving application:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // Fetch all applications for the logged-in user
    app.get("/applications/:email", async (req, res) => {
      const userEmail = req.params.email; // Extract email from the URL parameter

      try {
        const applications = await applicationCollection
          .find({ email: userEmail })
          .toArray();
        res.send(applications);
      } catch (error) {
        console.error("Error fetching applications:", error);
        res.status(500).send({ message: "Server error" });
      }
    });

    // Delete application
    app.delete("/applications/:id", async (req, res) => {
      const applicationId = req.params.id;

      try {
        const applicationCollection = client
          .db("visaDB")
          .collection("visaApplications");
        const result = await applicationCollection.deleteOne({
          _id: new ObjectId(applicationId),
        });

        if (result.deletedCount === 1) {
          res.send({ message: "Application canceled successfully" });
        } else {
          res.status(404).send({ message: "Application not found" });
        }
      } catch (error) {
        console.error("Error deleting application:", error);
        res.status(500).send({ message: "Server error" });
      }
    });











// Get all reviews
app.get('/reviews', async (req, res) => {
  try {
    const reviews = await reviewsCollection.find().toArray();
    res.json(reviews);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching reviews');
  }
});

// Add a new review
app.post('/reviews', async (req, res) => {
  try {
    const newReview = req.body;
    const result = await reviewsCollection.insertOne(newReview);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error adding review');
  }
});








    // Send a ping to confirm a successful connection

    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("visa server is running");
});

app.listen(port, () => {
  console.log(`visa server is running on port: ${port}`);
});
