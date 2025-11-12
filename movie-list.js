const express = require("express");
const { MongoClient } = require("mongodb");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const path = require("path"); // Import the path module

// MongoDB connection URI - connect to local MongoDB
const uri = 'mongodb+srv://NNQuang:nnq13042006@cluster0.rpet2xt.mongodb.net/?appName=Cluster0&retryWrites=true&w=majority';
const client = new MongoClient(uri);
const app = express();
app.set("view engine", "ejs");
// Use session middleware
app.use(
    session({
        secret: "abc",
        resave: false,
        saveUninitialized: true,
    })
);
app.use(bodyParser.urlencoded({ extended: false }));
// Initialize passport middleware
app.use(passport.initialize());
app.use(passport.session());
// Middleware to check if the user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session && req.session.authenticated) {
        return next();
    } else {
        res.redirect("/login");
    }
}
// Add the admin local strategy
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
// Add the User name and the password for the guest login
const users = [
    { id: 1, username: "abc", password: "123" },
    { id: 2, username: "user1", password: "user" },
];
passport.use(
    "user-local",
    new LocalStrategy(function (username, password, done) {
        const user = users.find((u) => u.username === username);
        if (!user) {
            return done(null, false, { message: "Incorrect username." });
        }
        if (user.password !== password) {
            return done(null, false, { message: "Incorrect password." });
        }
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
async function main() {
    try {
        await client.connect();
        console.log("Connected to MongoDB");
        const database = client.db();
        const collection =
            database.collection("MovieCollection"); // Adjust the collection name
        // Set up the views folder
        app.set("views", path.join(__dirname, "views"));
        app.use(express.static(path.join(__dirname, "template")));

        app.get("/", (req, res) => {
            console.log("Received request for /");
            res.sendFile(path.join(__dirname, "template", "movie-list.html"));
        });
        // Admin get and post
        // Admin login route
        app.get("/views/admin-login.ejs", function (req, res) {
            console.log("entered into admin-login page");
            res.render("admin-login");
        });
        // Admin login form
        app.post(
            "/admin-login",
            passport.authenticate("admin-local", {
                // successRedirect: path.join(__dirname, 'Templates', 'add-movie-form.html'),
                successRedirect: "/admin-dashboard",
                failureRedirect: "/admin-error",
            })
        );
        // Admin error route
        app.get("/admin-error", function (req, res) {
            console.log("getting an admin-error page");
            res.send(
                '<script>alert("Incorrect Admin username or password"); window.location.href = "/";</script>'
            );
        });
        // Admin dashboard route
        app.get("/admin-dashboard", function (req, res) {
            console.log("Entered into admin dashboard page");
            res.sendFile(path.join(__dirname, "template", "movie-list.html"));
        });
        // User login route
        app.get("/views/login.ejs", function (req, res) {
            console.log("Entered into user-login page.");
            res.render("login");
        });
        // User login form
        app.post(
            "/user-local",
            passport.authenticate("user-local", {
                // successRedirect: path.join(__dirname, 'Templates', 'add-movie-form.html'),
                successRedirect: "/user-dashboard",
                failureRedirect: "/user-error",
            })
        );
        // User error route
        app.get("/user-error", function (req, res) {
            console.log("Entered into user login error.");
            // res.render("admin-error", { errorMessage: "Incorrect admin username or password" });
            // Display an alert on the same page
            res.send(
                '<script>alert("Incorrect username or password"); window.location.href = "/";</script>'
            );
        });
        // user dashboard route
        app.get("/user-dashboard", function (req, res) {
            console.log("Entered into user dashboard page");
            res.sendFile(path.join(__dirname, "template", "book-seats-form.html"));
        });
        // Serve add-movie-form.html
        app.get("/add-movie-form.html", (req, res) => {
            console.log("Received request for /add-movie-form.html");
            res.sendFile(path.join(__dirname, "template", "add-movie-form.html"));
        });
        // Serve book-seats-form.html
        app.get("/book-seats-form.html", (req, res) => {
            res.sendFile(path.join(__dirname, "template", "book-seats-form.html"));
        });
        // Serve delete-movie-form.html
        app.get("/delete-movie-form.html", (req, res) => {
            res.sendFile(path.join(__dirname, "template", "delete-movie-form.html"));
        });
        // Serve update-seats-form.html
        app.get("/update-seats-form.html", (req, res) => {
            res.sendFile(__dirname + "/Templates/update-seats-form.html");
        });
        app.get("/get-movies", async (req, res) => {
            const category = req.query.category; // Get the selected category from query parameters
            try {
                // Fetch movies of the selected category from the database
                const movies = await collection.find({
                    Category:
                        category
                }).toArray();
                res.status(200).json(movies);
            } catch (error) {
                console.error("Error fetching movies:", error);
                res.status(500).json({ error: "Failed to fetch movies" });
            }
        });
        app.get("/get-all-movies", async (req, res) => {
            try {
                // Fetch movies of the selected category from the 
                database
                const movies = await collection.find().toArray();
                res.status(200).json(movies);
            } catch (error) {
                console.error("Error fetching movies:", error);
                res.status(500).json({ error: "Failed to fetch movies" });
            }
        });
        app.get("/get-movie-details", async (req, res) => {
            const movieName = req.query.name; // Get the selected movie name from query parameters
            try {
                // Fetch movie details based on the selected movie name from the database
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
                console.error("Error fetching movie details:",
                    error);
                res.status(500).json({ error: "Failed to fetch movie details" });
            }
        });
        // Handle the form submission and add a movie
        app.post("/add-movie", async (req, res) => {
            try {
                console.log("Add movie request body:", req.body);
                // Insert a new movie document into the MongoDB collection
                await collection.insertOne(req.body);
                console.log("Added movie to the database");
                // Display an alert on the same page and redirect to admin dashboard
                res.send('<script>alert("Movie added successfully"); window.location.href = "/admin-dashboard";</script>');
            } catch (error) {
                console.error("Error adding movie:", error);
                // Render an error message on the same page
                res.status(500).send("<h2>Failed to add the movie</h2>");
            }
        });
        // Handle booking seats
        app.post("/book-seats", async (req, res) => {
            try {
                // This checks if the user is an admin or a guest based on the authentication
                const isAdmin = req.isAuthenticated() &&
                    req.user.username === "Aptech";
                // Retrieve movie information from the request
                const movieNameToBook = req.body["Movie name"];
                const seatsToBook = parseInt(req.body["seats-to-book"]);
                // Check if the movie exists
                const existingMovie = await collection.findOne({ "Movie name": movieNameToBook });
                if (!existingMovie) {
                    console.log("Movie not found in the database.");
                    return res.send("Movie not found in the database.");
                }
                // Retrieve the available seats from the existing movie document
                const availableSeats = existingMovie["Available Seats"];
                //Check field name
                if (seatsToBook <= availableSeats) {
                    // Calculate the updated available seats
                    const updatedAvailableSeats = availableSeats -
                        seatsToBook;
                    // Update the document with new available seats
                    const result = await collection.updateOne(
                        { "Movie name": movieNameToBook }, {
                            $set: { "Available Seats": updatedAvailableSeats }
                    } //Check field name
                    );
                    // This will redirect to the route based on the users role admin or user using the conditional (ternary) operator concept
                    const redirectRoute = isAdmin ? '/admin-dashboard' :
                        '/user-dashboard';
                    if (result.modifiedCount === 1) {
                        // Display an alert and redirect to the appropriate 
                        route
                        const alertMessage = `Booking successful for 
${seatsToBook} seat(s) in ${movieNameToBook}`;
                        return res.send(`
<script>
alert("${alertMessage}");
window.location.href = "${redirectRoute}";
</script>
`);
                    } else {
                        console.log("Failed to update available seats");
                        const errorMessage = "Failed to update available seats";
                        // Display an alert on the same page
                        return res.send(`
<script>
alert("${errorMessage}");
window.location.href = "${redirectRoute}";
</script>
`);
                    }
                } else {
                    console.log(`Not enough seats available for 
${seatsToBook} seat(s) in ${movieNameToBook}`);
                    return res.send(`Not enough seats available for 
${seatsToBook} seat(s) in ${movieNameToBook}`);
                }
            } catch (error) {
                console.error("Error booking seats:", error);
                return res.status(500).send("Failed to book seats");
            }
        });
        // Handle delete movie
        app.post("/delete-movie", async (req, res) => {
            const movieNameToDelete = req.body["Movie name"];
            try {
                // Check if the movie existsconst 
                existingMovie = await collection.findOne({ "Movie name": movieNameToDelete, });
                if (!existingMovie) {
                    console.log("Movie not found in the database");
                    res.send("Movie not found in the database");
                } else {
                    // Delete the movie from the collection
                    const result = await collection.deleteOne({
                        "Movie name": movieNameToDelete,
                    });
                    if (result.deletedCount === 1) {
                        console.log("Movie deleted successfully");
                        // Display an alert on the same page and redirect to admin dashboard
                        res.send(
                            '<script>alert("Movie deleted successfully"); window.location.href = "/admin-dashboard";</script>');
                    } else {
                        console.log("Failed to delete the movie");
                        // Display an alert on the same page
                        res.send(
                            '<script>alert("Failed to delete the movie"); window.location.href = "/";</script>'
                        );
                    }
                }
            } catch (error) {
                console.error("Error deleting the movie:", error);
                res.status(500).send("Failed to delete the movie");
            }
        });
        // Handle updating available seats
        app.post("/update-seats", async (req, res) => {
            const movieNameToUpdate = req.body["Movie name"];
            const newAvailableSeats = parseInt(req.body["Available Seats"]); // Make sure the field name matches your MongoDB collection
            try {
                // Check if the movie exists
                const existingMovie = await collection.findOne({
                    "Movie name": movieNameToUpdate,
                });
                if (!existingMovie) {
                    console.log("Movie not found in the database");
                    // Display an alert on the same page
                    res.send(
                        '<script>alert("Movie not found in the database"); window.location.href = "/";</script>'
                    );
                } else {
                    // Update the available seats for the movie
                    console.log("Existing movie:", existingMovie);
                    const result = await collection.updateOne(
                        { _id: existingMovie._id }, // Use _id to uniquely identify the movie
                        {
                            $set: { "Available Seats": newAvailableSeats }
                        } // Make sure the field name matches your MongoDB collection
                    );
                    console.log("Update operation result:", result);
                    if (result.modifiedCount === 1) {
                        const alertMessage = `Updated available seats for 
${movieNameToUpdate} successfully`;
                        console.log(alertMessage);
                        // Display an alert on the same page and redirect to admin dashboard
                        res.send(
                            '<script>alert("${alertMessage}"); window.location.href = "/admin-dashboard";</script>');
                    } else {
                        console.log("Failed to update available seats");
                        res.status(500).send("Failed to update available seats");
                    }
                }
            } catch (error) {
                console.error("Error updating available seats:",
                    error);
                res.status(500).send("Failed to update available seats");
            }
        });
        //logout
        app.get("/logout", function (req, res) {
            console.log("Logout page activated.");
            req.logout(function (err) {
                if (err) { return next(err); }
                // Destroy session
                req.session.destroy(function (err) {
                    if (err) {
                        return res.send('Error logging out');
                    }
                    res.send('<script>alert("Logged out successfully"); window.location.href = "/";</script>');
                });
            });
        });
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
    }
}
main().catch(console.error);
app.listen(process.env.PORT || 3000, process.env.IP ||
    "0.0.0.0", () => {
        console.log("Server is running");
    });