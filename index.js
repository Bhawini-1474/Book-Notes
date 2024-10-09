import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import pg from "pg";
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import dotenv from "dotenv";

const app = express();
const port = 3000;
dotenv.config();

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true, // Only if you are using SSL; adjust as needed
  },
});
db.connect().catch(err => console.error('Connection error', err.stack));
  



app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0]);
  } catch (err) {
    done(err);
  }
});

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: 'https://book-notes-y9ft.onrender.com//auth/google/booklib'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let userResult = await db.query('SELECT * FROM users WHERE googleId = $1', [profile.id]);
    let user = userResult.rows[0];

    if (!user) {
      userResult = await db.query('INSERT INTO users (username, googleId) VALUES ($1, $2) RETURNING *', [profile.displayName, profile.id]);
      user = userResult.rows[0];
    }

    done(null, user);
  } catch (err) {
    done(err);
  }
}));

// Google OAuth routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/booklib',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/');
  });

// Logout route
app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect('/');
  });
});






// Function to fetch cover URL
const fetchUrl = async (isbn) => {
  try {
    const response = await axios.get(`https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`);
    return response.config.url;
  } catch (error) {
    console.log(`Could not fetch cover for ISBN ${isbn}`, error);
    return null;
  }
};

// Ensure user is authenticated middleware
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');
};

// Routes
app.get("/", async (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/home');
  }
  res.render("welcome.ejs");
});

app.get("/home", ensureAuthenticated, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM books WHERE user_id = $1 ORDER BY id ASC", [req.user.id]);
    const books = result.rows;
    res.render("index.ejs", { books, user: req.user });
  } catch (err) {
    console.log(err);
    res.redirect('/');
  }
});

app.get("/title", ensureAuthenticated, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM books WHERE user_id = $1 ORDER BY title", [req.user.id]);
    const books = result.rows;
    res.render("index.ejs", { books, user: req.user });
  } catch (err) {
    console.log(err);
    res.redirect('/');
  }
});

app.get("/rating", ensureAuthenticated, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM books WHERE user_id = $1 ORDER BY rating", [req.user.id]);
    const books = result.rows;
    res.render("index.ejs", { books, user: req.user });
  } catch (err) {
    console.log(err);
    res.redirect('/');
  }
});

app.get("/recency", ensureAuthenticated, async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM books WHERE user_id = $1 ORDER BY date_read", [req.user.id]);
    const books = result.rows;
    res.render("index.ejs", { books, user: req.user });
  } catch (err) {
    console.log(err);
    res.redirect('/');
  }
});

app.post("/add-book", ensureAuthenticated, async (req, res) => {
  const { title, author, isbn, review, rating, date_read } = req.body;
  const cover_url = await fetchUrl(isbn);
  try {
    await db.query(
      "INSERT INTO books (title, author, isbn, cover_url, review, rating, date_read, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [title, author, isbn, cover_url, review, rating, date_read, req.user.id]
    );
    res.redirect("/home");
  } catch (err) {
    console.log(err);
    res.redirect('/home');
  }
});

app.get("/add-book", ensureAuthenticated, (req, res) => {
  res.render("addbook.ejs", { user: req.user });
});

app.get('/book/:id', ensureAuthenticated, async (req, res) => {
  const bookId = req.params.id;
  try {
    const result = await db.query("SELECT * FROM books WHERE id = $1 AND user_id = $2", [bookId, req.user.id]);
    const book = result.rows[0];
    if (!book) {
      return res.redirect('/home'); // Redirect if book does not belong to user
    }
    res.render("bookdetail.ejs", { book, user: req.user });
  } catch (err) {
    console.log(err);
    res.redirect('/home');
  }
});

app.get('/edit-book/:id', ensureAuthenticated, async (req, res) => {
  const bookId = req.params.id;
  try {
    const result = await db.query("SELECT * FROM books WHERE id = $1 AND user_id = $2", [bookId, req.user.id]);
    const book = result.rows[0];
    if (!book) {
      return res.redirect('/home'); // Redirect if book does not belong to user
    }
    res.render("editBook.ejs", { book, user: req.user });
  } catch (err) {
    console.log(err);
    res.redirect('/home');
  }
});

app.post('/edit-book/:id', ensureAuthenticated, async (req, res) => {
  const bookId = req.params.id;
  const { title, author, isbn, review, rating, date_read } = req.body;
  const cover_url = await fetchUrl(isbn);
  try {
    await db.query(
      "UPDATE books SET title = $1, author = $2, isbn = $3, cover_url = $4, review = $5, rating = $6, date_read = $7 WHERE id = $8 AND user_id = $9",
      [title, author, isbn, cover_url, review, rating, date_read, bookId, req.user.id]
    );
    res.redirect(`/book/${bookId}`);
  } catch (err) {
    console.log(err);
    res.redirect('/home');
  }
});

app.get('/delete-book/:id', ensureAuthenticated, async (req, res) => {
  const bookId = req.params.id;
  try {
    await db.query("DELETE FROM books WHERE id = $1 AND user_id = $2", [bookId, req.user.id]);
    res.redirect('/home');
  } catch (err) {
    console.log(err);
    res.redirect('/home');
  }
});




app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
