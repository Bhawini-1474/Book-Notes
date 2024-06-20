import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import pg from "pg";

const app = express();
const port = 3000;

const db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "Book_Library",
    password: "bhanu123",
    port: 5432,
  });
  db.connect();

let books = [{
        id: 1,
        title: "The Kite Runner",
        author: "Khaled Hosseini",
        isbn: 9781594480003,
        cover_url: "http://covers.openlibrary.org/b/isbn/9781594480003-M.jpg",
        review: "As someone who deeply connects emotionally with characters like Hassan in The Kite Runner, you'd find his loyalty and innocence both inspiring and heart-wrenching. The novel's exploration of betrayal and redemption might resonate strongly with you, evoking a mix of admiration for Hassan's qualities and deep empathy for the consequences of Amir's actions. It's a story that explores complex emotions and the enduring impact of choices, offering a powerful portrayal of friendship and personal growth amidst hardship.",
        rating: 5,
        date_read: "2017-08-19"
    
}];



app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

const fetchUrl = async(isbn) => {
    try {
        const response = await axios.get(`https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`);
        return response.config.url;
      }
      catch(error){
        console.log(`could not fetch cover for ISBN ${isbn}`,error);
        return null;
      }
};
  


app.get("/",async (req,res) => {
  const result = await db.query("SELECT * FROM books ORDER BY id ASC");
  books = result.rows;
  res.render("index.ejs", {books:books});
})

app.get("/title",async (req,res) => {
  const result = await db.query("SELECT * FROM books ORDER BY title");
  books = result.rows;
  res.render("index.ejs", {books:books});
})

app.get("/rating",async (req,res) => {
  const result = await db.query("SELECT * FROM books ORDER BY rating");
  books = result.rows;
  res.render("index.ejs", {books:books});
})

app.get("/recency",async (req,res) => {
  const result = await db.query("SELECT * FROM books ORDER BY date_read");
  books = result.rows;
  res.render("index.ejs", {books:books});
})

app.post("/add-book",async (req,res) =>{
  const title = req.body.title;
  const author = req.body.author;
  const isbn = req.body.isbn;
  const review = req.body.review;
  const rating = req.body.rating;
  const date = req.body.date_read;
  const cover_url = await fetchUrl(isbn);
  
  try {
    await db.query(
      "INSERT INTO books(title,author,isbn,cover_url,review,rating,date_read) VALUES($1,$2,$3,$4,$5,$6,$7);",[title,author,isbn,cover_url,review,rating,date]);
      res.redirect("/");
    
  } catch (err) {
    console.log(err);
  }
});

app.get("/add-book", (req, res) => {
    res.render("addbook.ejs");
  });

app.get("/")
app.listen(port, () =>{
    console.log(`Server is listening on port ${port}`);
})