const express = require("express");
const { MongoClient } = require("mongodb");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("passport");
const mongoose = require("mongoose");
const LocalStrategy = require("passport-local");
const path = require("path");

const uri =
  "mongodb+srv://nhhung:hung%401508@cluster0.u4fto6r.mongodb.net/Movie?retryWrites=true&w=majority"; // MongoDB connection URI
const client = new MongoClient(uri);
const app = express();

app.set("view engine", "ejs");

// Session middleware
app.use(
  session({
    secret: "abc",
    resave: false,
    saveUninitialized: true,
  })
);
app.use(bodyParser.urlencoded({ extended: false }));

// Passport setup
app.use(passport.initialize());
app.use(passport.session());

// Authentication middleware
function isAuthenticated(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  else res.redirect("/login");
}

// Admin local strategy
passport.use(
  "admin-local",
  new LocalStrategy(function (username, password, done) {
    if (username === "Admin" && password === "12345") {
      return done(null, { username: "Aptech" });
    }
    return done(null, false, {
      message: "Incorrect admin username or password",
    });
  })
);

passport.serializeUser(function (user, done) {
  done(null, user);
});
passport.deserializeUser(function (user, done) {
  done(null, user);
});

// Guest users
const users = [
  { id: 1, username: "abc", password: "123" },
  { id: 2, username: "user1", password: "user" },
];

passport.use(
  "user-local",
  new LocalStrategy(function (username, password, done) {
    const user = users.find((u) => u.username === username);
    if (!user) return done(null, false, { message: "Incorrect username." });
    if (user.password !== password)
      return done(null, false, { message: "Incorrect password." });
    return done(null, user);
  })
);

passport.serializeUser(function (user, done) {
  done(null, user.id);
});
passport.deserializeUser(function (id, done) {
  const user = users.find((u) => u.id === id);
  done(null, user);
});

// Main connection
async function main() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
    const database = client.db();
    const collection = database.collection("MovieCollection");

    app.set("views", path.join(__dirname, "views"));

    // Root route
    app.get("/", (req, res) => {
      console.log("Received request for /");
      res.sendFile(__dirname + "/template/wonderland.html");
    });

    // Admin routes
    app.get("/views/admin-login.ejs", (req, res) => {
      console.log("entered into admin-login page");
      res.render("admin-login");
    });

    app.post(
      "/admin-login",
      passport.authenticate("admin-local", {
        successRedirect: "/admin-dashboard",
        failureRedirect: "/admin-error",
      })
    );

    app.get("/admin-error", (req, res) => {
      res.send(
        '<script>alert("Incorrect Admin username or password"); window.location.href = "/";</script>'
      );
    });

    app.get("/admin-dashboard", (req, res) => {
      res.sendFile(__dirname + "/template/movie-list.html");
    });

    // User routes
    app.get("/views/login.ejs", (req, res) => {
      res.render("login");
    });

    app.post(
      "/user-local",
      passport.authenticate("user-local", {
        successRedirect: "/user-dashboard",
        failureRedirect: "/user-error",
      })
    );

    app.get("/user-error", (req, res) => {
      res.send(
        '<script>alert("Incorrect username or password"); window.location.href = "/";</script>'
      );
    });

    app.get("/user-dashboard", (req, res) => {
      res.sendFile(__dirname + "/template/book-seats-form.html");
    });

    // Serve templates
    app.get("/add-movie-form.html", (req, res) =>
      res.sendFile(__dirname + "/template/add-movie-form.html")
    );

    app.get("/book-seats-form.html", (req, res) =>
      res.sendFile(__dirname + "/template/book-seats-form.html")
    );

    app.get("/delete-movie-form.html", (req, res) =>
      res.sendFile(__dirname + "/template/delete-movie-form.html")
    );

    app.get("/update-seats-form.html", (req, res) =>
      res.sendFile(__dirname + "/template/update-seats-form.html")
    );

    // API routes
    app.get("/get-movies", async (req, res) => {
      const category = req.query.category;
      try {
        const movies = await collection.find({ Category: category }).toArray();
        res.status(200).json(movies);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch movies" });
      }
    });

    app.get("/get-all-movies", async (req, res) => {
      try {
        const movies = await collection.find().toArray();
        res.status(200).json(movies);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch movies" });
      }
    });

    app.get("/get-movie-details", async (req, res) => {
      const movieName = req.query.name;
      try {
        const movie = await collection.findOne({ "Movie name": movieName });
        if (movie) {
          res.status(200).json({
            Description: movie["Description"],
            Actors: movie["Actors"],
          });
        } else {
          res.status(404).json({ error: "Movie not found" });
        }
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch movie details" });
      }
    });

    // Add movie
    app.post("/add-movie", async (req, res) => {
      try {
        await collection.insertOne(req.body);
        res.send(
          '<script>alert("Movie added successfully"); window.location.href = "/admin-dashboard";</script>'
        );
      } catch (error) {
        res.status(500).send("<h2>Failed to add the movie</h2>");
      }
    });

    // Book seats
    app.post("/book-seats", async (req, res) => {
      try {
        const isAdmin = req.isAuthenticated() && req.user.username === "Aptech";
        const movieNameToBook = req.body["Movie name"];
        const seatsToBook = parseInt(req.body["seats-to-book"]);
        const existingMovie = await collection.findOne({
          "Movie name": movieNameToBook,
        });
        if (!existingMovie) return res.send("Movie not found in the database.");

        const availableSeats = existingMovie["Available Seats"];
        if (seatsToBook <= availableSeats) {
          const updatedAvailableSeats = availableSeats - seatsToBook;
          const result = await collection.updateOne(
            { "Movie name": movieNameToBook },
            { $set: { "Available Seats": updatedAvailableSeats } }
          );
          const redirectRoute = isAdmin
            ? "/admin-dashboard"
            : "/user-dashboard";
          if (result.modifiedCount === 1) {
            const alertMessage = `Booking successful for ${seatsToBook} seat(s) in ${movieNameToBook}`;
            return res.send(
              `<script>alert("${alertMessage}"); window.location.href = "${redirectRoute}";</script>`
            );
          } else {
            return res.send(
              `<script>alert("Failed to update available seats"); window.location.href = "${redirectRoute}";</script>`
            );
          }
        } else {
          res.send(
            `Not enough seats available for ${seatsToBook} seat(s) in ${movieNameToBook}`
          );
        }
      } catch (error) {
        res.status(500).send("Failed to book seats");
      }
    });

    // Delete movie
    app.post("/delete-movie", async (req, res) => {
      const movieNameToDelete = req.body["Movie name"];
      try {
        const existingMovie = await collection.findOne({
          "Movie name": movieNameToDelete,
        });
        if (!existingMovie) {
          res.send("Movie not found in the database");
        } else {
          const result = await collection.deleteOne({
            "Movie name": movieNameToDelete,
          });
          if (result.deletedCount === 1) {
            res.send(
              '<script>alert("Movie deleted successfully"); window.location.href = "/admin-dashboard";</script>'
            );
          } else {
            res.send(
              '<script>alert("Failed to delete the movie"); window.location.href = "/";</script>'
            );
          }
        }
      } catch (error) {
        res.status(500).send("Failed to delete the movie");
      }
    });

    // Update seats
    app.post("/update-seats", async (req, res) => {
      const movieNameToUpdate = req.body["Movie name"];
      const newAvailableSeats = parseInt(req.body["Available Seats"]);
      try {
        const existingMovie = await collection.findOne({
          "Movie name": movieNameToUpdate,
        });
        if (!existingMovie) {
          res.send(
            '<script>alert("Movie not found in the database"); window.location.href = "/";</script>'
          );
        } else {
          const result = await collection.updateOne(
            { _id: existingMovie._id },
            { $set: { "Available Seats": newAvailableSeats } }
          );
          if (result.modifiedCount === 1) {
            res.send(
              '<script>alert("Updated successfully"); window.location.href = "/admin-dashboard";</script>'
            );
          } else {
            res.status(500).send("Failed to update available seats");
          }
        }
      } catch (error) {
        res.status(500).send("Failed to update available seats");
      }
    });

    // Logout
    app.get("/logout", (req, res) => {
      res.sendFile(__dirname + "/Templates/wonderland.html");
    });
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

main().catch(console.error);

app.listen(process.env.PORT || 3000, () => {
  console.log("Server is running");
});
