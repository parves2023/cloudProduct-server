const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const SSLCommerzPayment = require("sslcommerz-lts");
const axios = require("axios");

app.use(express.urlencoded({ extended: true })); // Parses form data
app.use(express.json()); // Parses JSON data



const store_id = process.env.SSLCOMMERZ_STORE_ID;
const store_passwd = process.env.SSLCOMMERZ_STORE_PASSWD;
const is_live = false; // Change to true for production



// console.log("Stripe initialized:", stripe ? "Success" : "Failed");


// app.use(
//   cors({
//     origin: "https://visapilot.netlify.app", // Specify your frontend domain here
//     methods: ["GET", "POST", "PUT", "DELETE"], // Adjust methods as needed
//     allowedHeaders: ["Content-Type"], // You can add more headers if needed
//   })
// );


// https://cloudproducts.vercel.app
// http://localhost:5000

// Store ID: cloud67e1a58b8c5f1
// Store Password (API/Secret Key): cloud67e1a58b8c5f1@ssl


// Merchant Panel URL: https://sandbox.sslcommerz.com/manage/ (Credential as you inputted in the time of registration)


 
// Store name: testcloudmklm
// Registered URL: https://cloudproducts.netlify.app/
// Session API to generate transaction: https://sandbox.sslcommerz.com/gwprocess/v3/api.php
// Validation API: https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php?wsdl
// Validation API (Web Service) name: https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php





// bkash payment 

// Replace with your actual bKash credentials
const BKASH_BASE_URL = "https://checkout.sandbox.bka.sh/v1.2.0-beta";
const BKASH_USERNAME = process.env.BKASH_USERNAME;
const BKASH_PASSWORD = process.env.BKASH_PASSWORD;
const BKASH_APP_KEY = process.env.BKASH_APP_KEY;
const BKASH_APP_SECRET = process.env.BKASH_APP_SECRET;

let bkashToken = null;




app.use(
  cors({
    origin: ["https://cloudproducts.netlify.app", "http://localhost:5173" ],
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
    const reviewsPH = client.db("productHuntDB").collection("reviews");
    const cuponsPH = client.db("productHuntDB").collection("cupon");





        // jwt related api
        app.post('/jwt', async (req, res) => {
          const user = req.body;
          const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
          res.send({ token });
        })




 // middlewares 
 const verifyToken = (req, res, next) => {
  // console.log('inside verify token', req.headers.authorization);
  if (!req.headers.authorization) {
    return res.status(401).send({ message: 'unauthorized access' });
  }
  const token = req.headers.authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}






        








// add cupons
app.post('/api/coupons', async (req, res) => {
  const coupon = req.body;
  const result = await cuponsPH.insertOne(coupon);
  if (result.acknowledged) {
    const insertedCoupon = await cuponsPH.findOne({ _id: result.insertedId });
    res.send(insertedCoupon); // Return the full document
  } else {
    res.status(500).send({ error: "Failed to insert coupon" });
  }
});


/// get coupon discount
app.post('/validate-coupon', async (req, res) => {
  const { couponCode, amount } = req.body;

  try {
      // Fetch the coupon from the database
      const coupon = await cuponsPH.findOne({ code: couponCode });

      if (!coupon) {
          return res.status(404).json({ success: false, message: "Invalid coupon code" });
      }

      // Check if the coupon has expired
      const currentDate = new Date();
      if (new Date(coupon.expiryDate) < currentDate) {
          return res.status(400).json({ success: false, message: "Coupon has expired" });
      }

      // Calculate the discounted amount
      const discountAmount = (amount * coupon.discount) / 100;
      const finalAmount = Math.max(amount - discountAmount, 0); // Ensure no negative values

      res.json({ success: true, discountAmount, finalAmount });
  } catch (error) {
      console.error('Error validating coupon:', error);
      res.status(500).json({ success: false, message: "Internal server error" });
  }
});


//Fetch all coupons
app.get('/api/coupons', async (req, res) => {
  const coupons = await cuponsPH.find({}).toArray();
  res.send(coupons);
});

//Delete a coupon
app.delete('/api/coupons/:id', async (req, res) => {
  const id = req.params.id;
  const result = await cuponsPH.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});





     // Route to handle membership status update
     app.post('/update-membership-status', async (req, res) => {
      const { email, transactionId } = req.body;

      try {
          // Update the user's membership status in the MongoDB collection
          const updateResult = await usersPH.updateOne(
              { email: email }, // Search by user's email
              {
                  $set: { membershipStatus: "verified", transactionId: transactionId }, // Set membership status to "verified"
              },
              { upsert: true } // Create the document if it doesn't exist
          );

          if (updateResult.modifiedCount > 0 || updateResult.upsertedCount > 0) {
              res.json({ success: true, message: "Membership status updated successfully" });
          } else {
              res.json({ success: false, message: "No changes made to the user's status" });
          }
      } catch (error) {
          console.error("Error updating membership status:", error);
          res.status(500).json({ success: false, message: "Error updating membership status" });
      }
  });












   // Route to check membership status
   app.post('/check-membership-status', async (req, res) => {
    const { email } = req.body;

    try {
        // Find the user by email
        const user = await usersPH.findOne({ email: email });

        if (user && user.membershipStatus === "verified") {
            res.json({ success: true, status: "verified" });
        } else {
            res.json({ success: true, status: "not_verified" });
        }
    } catch (error) {
        console.error("Error checking membership status:", error);
        res.status(500).json({ success: false, message: "Error checking membership status" });
    }
});

















// 🔹 1️⃣ Generate bKash Token
const generateBkashToken = async () => {
  try {
    const response = await axios.post(`${BKASH_BASE_URL}/checkout/token/grant`, {
      app_key: BKASH_APP_KEY,
      app_secret: BKASH_APP_SECRET,
    }, {
      headers: { "Content-Type": "application/json" },
      auth: { username: BKASH_USERNAME, password: BKASH_PASSWORD },
    });

    bkashToken = response.data.id_token;
    console.log("🔑 bKash Token Generated:", bkashToken);
  } catch (error) {
    console.error("❌ Error generating bKash token:", error.response?.data || error.message);
  }
};

// 🔹 2️⃣ Initiate bKash Payment
app.post("/initiate-bkash-payment", async (req, res) => {
  const { amount, user } = req.body;

  if (!bkashToken) await generateBkashToken(); // Ensure token is available

  try {
    const response = await axios.post(`${BKASH_BASE_URL}/checkout/payment/create`, {
      mode: "0011", // Sandbox mode
      payerReference: user.email, // Use email as reference
      callbackURL: "http://localhost:5000/bkash-payment-success",
      amount: amount.toString(),
      currency: "BDT",
      intent: "sale",
    }, {
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${bkashToken}`,
        "X-App-Key": BKASH_APP_KEY,
      },
    });

    if (response.data.paymentID) {
      res.json({ url: response.data.bkashURL }); // Redirect user to bKash payment page
    } else {
      res.status(400).json({ message: "Failed to initiate bKash payment" });
    }
  } catch (error) {
    console.error("❌ Error initiating bKash payment:", error.response?.data || error.message);
    res.status(500).json({ message: "bKash payment initiation failed" });
  }
});




// 🔹 3️⃣ Handle Payment Success
app.post("/bkash-payment-success", async (req, res) => {
  const { paymentID } = req.body;

  try {
    const response = await axios.post(`${BKASH_BASE_URL}/checkout/payment/execute`, {
      paymentID,
    }, {
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${bkashToken}`,
        "X-App-Key": BKASH_APP_KEY,
      },
    });

    if (response.data.transactionStatus === "Completed") {
      res.json({ success: true, message: "Payment successful" });
    } else {
      res.json({ success: false, message: "Payment not completed" });
    }
  } catch (error) {
    console.error("❌ Error executing bKash payment:", error.response?.data || error.message);
    res.status(500).json({ message: "Payment execution failed" });
  }
});









const BASE_URL = is_live
  ? "https://securepay.sslcommerz.com"
  : "https://sandbox.sslcommerz.com";


// SSLCommerz payment initiation
app.post("/initiate-ssl-payment", async (req, res) => {
  try {
    const { amount, user } = req.body;

    const data = {
      store_id,
      store_passwd,
      total_amount: amount,
      currency: "BDT",
      tran_id: `txn_${Date.now()}`,
      success_url: `https://cloudproducts.vercel.app/payment-success?email=${user?.email}&redirect=true`, // Add redirect param
      fail_url: "https://cloudproducts.vercel.app/payment-fail",
      cancel_url: "https://cloudproducts.vercel.app/payment-cancel",
      ipn_url: "https://cloudproducts.vercel.app/ipn",
      cus_name: user.name,
      cus_email: user.email,
      cus_add1: "Dhaka",
      cus_phone: user.phone || "01700000000",
      shipping_method: "NO",
      product_name: "Premium Subscription",
      product_category: "Subscription",
      product_profile: "general",
    };
    

    // Initialize SSLCommerz payment request
    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);

    const response = await sslcz.init(data);

    // If payment initiation is successful, return the payment URL
    if (response?.GatewayPageURL) {
      res.json({ url: response.GatewayPageURL });
    } else {
      res.status(500).json({ error: "SSLCommerz payment initiation failed", details: response });
    }
  } catch (error) {
    console.error("SSLCommerz Error:", error);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

// SSLCommerz payment success check
app.post("/payment-success", async (req, res) => {
  try {
    const userEmail = req.query.email;
    const redirect = req.query.redirect === "true"; // Check if redirection is required

    const { val_id, tran_id, amount, currency, status } = req.body;

    if (!val_id || !tran_id || !amount || !currency || status !== "VALID") {
      console.log("[ERROR] Invalid Payment Data:", req.body);
      return res.status(400).json({ error: "Payment is not valid or missing required fields" });
    }

    console.log("[INFO] Received Payment Data:", { val_id, tran_id, amount, currency, status, userEmail });

    const validationURL = `https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php?val_id=${val_id}&store_id=${store_id}&store_passwd=${store_passwd}&format=json`;

    const validationResponse = await axios.get(validationURL);
    const validationData = validationResponse.data;

    console.log("[INFO] SSLCommerz Validation Response:", validationData);

    if ((validationData?.status === "VALIDATED" || validationData?.status === "VALID") && validationData?.currency === "BDT") {
      console.log("[INFO] Payment Verified Successfully:", validationData);

      if (!userEmail) {
        console.error("[ERROR] User email not found in the request.");
        return res.status(400).json({ error: "User email not found in payment data" });
      }

      // Update user membership in MongoDB
      const updateResult = await usersPH.updateOne(
        { email: userEmail },
        { 
          $set: { 
            membershipStatus: "verified", 
            transactionId: tran_id 
          }
        },
        { upsert: true }
      );

      if (updateResult.modifiedCount === 0 && updateResult.upsertedCount === 0) {
        console.error("[ERROR] Failed to update or insert membership for user:", userEmail);
        return res.status(500).json({ error: "Failed to update or insert membership" });
      }

      console.log("[INFO] Membership updated successfully for:", userEmail);

      // ✅ Redirect to frontend if required
      if (redirect) {
        return res.redirect(`https://cloudproducts.netlify.app/dashboard/my-profile`);
      }

      return res.json({ message: "Membership updated successfully!" });
    } else {
      console.log("[ERROR] Payment validation failed:", validationData);
      return res.status(400).json({ error: "Payment validation failed" });
    }
  } catch (error) {
    console.error("[ERROR] Payment validation error:", error);
    return res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});





















   
// stripe payment system
app.post("/payment-success", async (req, res) => {
  try {
    const { val_id, tran_id, amount, currency, status, user } = req.body;

    if (!val_id || !tran_id || !amount || !currency || status !== "VALID") {
      console.log("[ERROR] Invalid Payment Data:", req.body);
      return res.status(400).json({ error: "Payment is not valid or missing required fields" });
    }

    console.log("[INFO] Received Payment Data:", {
      val_id,
      tran_id,
      amount,
      currency,
      status,
      email: user?.email,
    });

    // Validate the transaction with SSLCommerz API
    const validationURL = `https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php?val_id=${val_id}&store_id=${store_id}&store_passwd=${store_passwd}&format=json`;

    const validationResponse = await axios.get(validationURL);
    const validationData = validationResponse.data;

    console.log("[INFO] SSLCommerz Validation Response:", validationData);

    if ((validationData?.status === "VALIDATED" || validationData?.status === "VALID") && validationData?.currency === "BDT") {
      console.log("[INFO] Payment Verified Successfully:", validationData);

      if (!user?.email) {
        console.error("[ERROR] User email not found.");
        return res.status(400).json({ error: "User email not found in payment data" });
      }

      // **Save to MongoDB like Stripe system**
      const updateResult = await usersPH.updateOne(
        { email: user.email },  // Find user by email
        {
          $set: {
            membership: "premium", 
            transactionId: tran_id,
          },
        },
        { upsert: true } // Insert if not exists
      );

      if (updateResult.modifiedCount === 0 && updateResult.upsertedCount === 0) {
        console.error("[ERROR] Failed to update or insert membership for user:", user.email);
        return res.status(500).json({ error: "Failed to update or insert membership" });
      }

      console.log("[INFO] Membership updated/inserted successfully for:", user.email);
      return res.json({ message: "Membership updated successfully!" });
    } else {
      console.log("[ERROR] Payment validation failed:", validationData);
      return res.status(400).json({ error: "Payment validation failed" });
    }
  } catch (error) {
    console.error("[ERROR] Payment validation error:", error);
    return res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});



  
  
  





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
app.get("/api/products", verifyToken, async (req, res) => {
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
app.patch("/api/products/:id", verifyToken, async (req, res) => {
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










// Mark or unmark a product as featured
app.patch('/products/mark-as-featured/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { markAsFeatured } = req.body;

  try {
    const result = await productsPH.updateOne(
      { _id: new ObjectId(id) }, // Match the product by ID
      { $set: { markAsFeatured } } // Update the `markAsFeatured` field
    );

    if (result.modifiedCount > 0) {
      res.status(200).json({ success: true, message: `Product ${markAsFeatured ? "marked as" : "unmarked as"} featured.` });
    } else {
      res.status(404).json({ success: false, message: "Product not found." });
    }
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ success: false, error: "Failed to update product featured status." });
  }
});



//add report 
app.patch('/products/report/:id', async (req, res) => {
  const { id } = req.params;
  const { reportedBy, reportDetails } = req.body;

  if (!reportedBy || !reportDetails) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await productsPH.updateOne(
      { _id: new ObjectId(id) },
      {
        $push: {
          reports: { reportedBy, reportDetails, reportedAt: new Date() },
        },
      },
      { upsert: true }
    );

    if (result.modifiedCount > 0 || result.upsertedCount > 0) {
      res.status(200).json({ message: 'Report added successfully' });
    } else {
      res.status(400).json({ error: 'Failed to report product' });
    }
  } catch (error) {
    console.error('Error reporting product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});





// Fetch reported posts
app.get("/reported-posts", async (req, res) => {
  try {
    // Query to find products with non-empty `reports` array
    const reportedPosts = await productsPH
      .find({ reports: { $exists: true, $ne: [] } })
      .toArray();

    res.status(200).json(reportedPosts);
  } catch (error) {
    console.error("Error fetching reported posts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


// delete post
app.delete('/products/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await productsPH.deleteOne({ _id: new ObjectId(id) });
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// delete report
app.patch('/products/:id/delete-report', async (req, res) => {
  const { id } = req.params;
  const { reportIndex } = req.body;

  try {
    const result = await productsPH.updateOne(
      { _id: new ObjectId(id) },
      { $unset: { [`reports.${reportIndex}`]: 1 } }
    );

    // Clean up empty slots
    await productsPH.updateOne(
      { _id: new ObjectId(id) },
      { $pull: { reports: null } }
    );

    res.status(200).json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});







/// admin routes


// admin statistics page
app.get("/api/statistics", verifyToken, async (req, res) => {
  try {
    const totalUsers = await usersPH.countDocuments();
    const totalProducts = await productsPH.countDocuments();
    const acceptedProducts = await productsPH.countDocuments({ status: "approved" });
    const pendingProducts = await productsPH.countDocuments({ status: "pending" });
    const totalReviews = await reviewsPH.countDocuments();

    res.send({
      totalUsers,
      totalProducts,
      acceptedProducts,
      pendingProducts,
      totalReviews,
    });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    res.status(500).send({ error: "Failed to fetch statistics" });
  }
});









// Get users grouped by roles with MongoDB queries
// Get users by role
app.get("/users",verifyToken, async (req, res) => {
  try {
    const { role } = req.query;
    // Query based on the provided role
    const query = role ? { role } : {};
    const users = await usersPH.find(query).toArray();

    

    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});





/// change user role
app.patch("/users/:id",verifyToken, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  try {
    const result = await usersPH.updateOne(
      { _id: new ObjectId(id) },
      { $set: { role } }
    );
    if (result.modifiedCount > 0) {
      res.status(200).json({ message: "Role updated successfully" });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});




// Backend route to get featured products
app.get('/api/featured-products', async (req, res) => {
  try {
    const products = await productsPH.find({ markAsFeatured: true }).toArray();
    res.status(200).json(products);
  } catch (error) {
    console.error("Error fetching featured products:", error);
    res.status(500).json({ error: "Internal server error" });
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


// Get User Info by Email
app.get("/checkuserstatus", async (req, res) => {
  const email = req.query.email;
  const user = await usersPH.findOne({ email });
  res.send(user);
});

//Get Products by User Email:
app.get("/checkproductslength", async (req, res) => {
  const email = req.query.email;
  const userProducts = await productsPH.find({ creatorEmail: email }).toArray();
  res.send(userProducts);
});



// add and remove like
app.patch('/products/like/:id', async (req, res) => {
  const { id } = req.params;
  const { userEmail, userName, likeCount } = req.body;

  try {
    const product = await productsPH.findOne({ _id: new ObjectId(id) });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const hasLiked = product.likes?.some(like => like.email === userEmail);

    if (hasLiked) {
      // Remove like and update likeCount
      await productsPH.updateOne(
        { _id: new ObjectId(id) },
        {
          $pull: { likes: { email: userEmail } },
          $set: { likeCount: likeCount - 1 }, // Update likeCount with provided value
        }
      );
    } else {
      // Add like and update likeCount
      await productsPH.updateOne(
        { _id: new ObjectId(id) },
        {
          $push: { likes: { email: userEmail, name: userName } },
          $set: { likeCount: likeCount + 1 }, // Update likeCount with provided value
        }
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error handling like:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});






// Trending Products Route
app.get('/products/trending', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 6; // Parse limit from query, default to 6

    // Fetch products and sort them by the length of the 'likes' array in descending order
    const products = await productsPH
      .find({})
      .sort({ "likeCount": -1 }) // Sort by the length of the 'likes' array in descending order
      .limit(limit)
      .toArray();



    res.status(200).json({ success: true, products });
  } catch (error) {
    console.error('Error fetching trending products:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
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



// Delete a specific product
app.delete('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const result = await productsPH.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Failed to delete product' });
  }
});








// Update a specific product

app.put('/products/:id', async (req, res) => {
  const { id } = req.params;
  const { name, category, price, externalLink, tags, image, description } = req.body;

  // Validate ID
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid product ID' });
  }

  // Construct the updated data
  const updatedData = {
    ...(name && { name }),
    ...(category && { category }),
    ...(price && { price: parseFloat(price) }), // Ensure price is a number
    ...(externalLink && { externalLink }),
    ...(tags && { tags: Array.isArray(tags) ? tags : tags.split(',').map((tag) => tag.trim()) }),
    ...(image && { image }),
    ...(description && { description }),
    updatedAt: new Date(), // Add a timestamp for when the product was updated
  };

  try {
    // Update the product in the database
    const result = await productsPH.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.status(200).json({
      message: 'Product updated successfully',
      updatedProduct: { _id: id, ...updatedData },
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Failed to update product', error: error.message });
  }
});















































// Get all products with pagination, filtering by tags, and sorting by price
app.get('/products', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 6;
  const skip = (page - 1) * limit;
  const filter = { status: "approved" };

  const { tags, sortByPrice } = req.query;

  // Add filtering by tags
  if (tags) {
    const tagsArray = tags.split(',').map((tag) => {
      return { tags: { $regex: tag.trim(), $options: 'i' } };
    });
    filter.$or = tagsArray;
  }

  try {
    // Count total filtered products
    const totalProducts = await productsPH.countDocuments(filter);

    // Sorting logic
    let sortOption = { createdAt: -1 }; // Default: Most recent
    if (sortByPrice) {
      sortOption = { price: sortByPrice === 'lowToHigh' ? 1 : -1 }; // 1 = Ascending, -1 = Descending
    }

    // Fetch paginated and sorted products
    const products = await productsPH
      .find(filter)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .toArray();

    res.status(200).json({
      success: true,
      products,
      currentPage: page,
      totalPages: Math.ceil(totalProducts / limit),
      totalProducts,
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
    });
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



app.post("/reviews", async (req, res) => {
 
  
  const { productId, userEmail, userName, rating, review, createdAt, userImg } = req.body;

  if (!productId || !userEmail || !userName || !rating || !review) {
    return res.status(400).json({ success: false, message: "All fields are required." });
  }

  try {
  
    const result = await reviewsPH.insertOne({
      productId,
      userEmail,
      userName,
      userImg,
      rating,
      review,
      createdAt,
    });

    res.status(201).json({ success: true, message: "Review submitted successfully!", result });
  } catch (error) {
    console.error("Error saving review:", error);
    res.status(500).json({ success: false, message: "Failed to save review." });
  }
});






// Get reviews by product ID
app.get("/products/:id/reviews", async (req, res) => {
  const productId = req.params.id;

  try {
    const reviews = await reviewsPH.find({ productId }).toArray(); // Fetch reviews matching the productId

    if (reviews.length > 0) {
      res.status(200).json({ success: true, reviews });
    } else {
      res.status(404).json({ success: false, message: "No reviews found for this product." });
    }
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ success: false, message: "Failed to fetch reviews." });
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
