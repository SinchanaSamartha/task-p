const bodyParser = require('body-parser');
const path = require('path');
const mysql = require('mysql2');
const cors = require('cors');
const express = require('express');
require('dotenv').config();
const ExcelJS = require('exceljs');
const fs = require('fs');


const bcrypt = require('bcryptjs');
const session = require('express-session');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;


app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true
}));
app.use(express.static('public'));



// Routes
app.get('/index/:search/:eid', (req, res) => {
  let eid = req.query.eid;

  // Validate eid
  if (!eid || isNaN(eid)) {
    eid = null;
    return res.render('index', { record: null, searchPerformed: true, searchEid: eid, error: 'Invalid Employee ID' });
  }

  db.query('SELECT * FROM ud WHERE eid = ?', [eid], (error, results) => {
    if (error) {
      return res.status(500).send(error);
    }
    if (results.length > 0) {
    
     
      
      res.send( { record:JSON.stringify( results[0]), searchPerformed: true, searchEid: eid, error: null, });

    } else {
      // res.render('index1.ejs', { record: null, searchPerformed: true, searchEid: eid, error: 'No record found' });
    }
  });
});

// Handle form submission
app.post('/submit', (req, res) => {
  const {eid,ename,client,wh,loc} = req.body;
  const sql = 'INSERT INTO employee (eid,ename,client,wh,loc) VALUES (?,?,?,?,?)';

  db.query(sql, [eid,ename,client,wh,loc], (err, result) => {
    if (err) {
      console.error('Error saving data:', err.stack);
      res.status(500).send('Error saving data');
      return;
    }
    res.send('Data saved successfully');
  });
});




app.get('/index', (req, res) => {
  res.sendFile(path.join(__dirname,'public', 'index.html'));
});



// Route for user registration
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 3);

  db.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], (err, results) => {
    if (err) {
      console.error('Error inserting user:', err.stack);
      res.status(500).send('Error registering user');
      return;
    }
    res.send('User registered successfully! <a href="/">Login</a>');
  });
});

// Route for user login
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.query('SELECT * FROM ud WHERE username = ?', [username], async (err, results) => {
    if (err) {
      console.error('Error fetching user:', err.stack);
      res.status(500).send('Error logging in');
      return;
    }
    console.log("results",results);
    if (results.length > 0) {
      const user = results[0];
      console.log('user',user)
      console.log('password',user.password)
      console.log('password',user.password)
      const isMatch = await bcrypt.compare(password, user.password);
      console.log("isMatch",isMatch);
      if (password == user.password) {
        req.session.loggedin = true;
        req.session.username = username;
        console.log("username",username);
        res.redirect(`/index`)
        
        
      } else {
        res.send('Incorrect username or password! <a href="/">Try again</a>');
      }
    } else {
      console.log('no result');
      res.send('no result');
    }
  });
});

// Route for user logout
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error logging out:', err.stack);
      res.status(500).send('Error logging out');
      return;
    }
    res.redirect('/');
  });
});

// Protected route example
app.get('/protected', (req, res) => {
  if (req.session.loggedin) {
    res.send(`Welcome, ${req.session.username}! <a href="/logout">Logout</a>`);
  } else {
    res.send('Please login to view this page! <a href="/">Login</a>');
  }
});

app.get('/ud/:id',(req,res)=>{
  db.query('SELECT * FROM ud where eid=1',[req.params.id],(err,rows)=>{
    if(err){
      console.log(err)
    }
    else{
      res.json(rows);
    }
  })
});

app.get('/events/:day/:month/:year', (req, res) => {
  const { day, month, year } = req.params;
  const query = 'SELECT * FROM tasks WHERE day = ? AND month = ? AND year = ?';
  const values = [day, month, year];

  db.query(query, values, (err, results) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).json({ error: 'Failed to fetch events.' });
      return;
    }
    res.json(results);
  });
});


app.get('/totalHours/:year/:month/:day', (req, res) => {
  const { year, month, day } = req.params;

  // Construct the date in YYYY-MM-DD format
  const date = `${year}-${month}-${day}`;

  // Write a query to fetch the sum of totalHours for the specified day
  const query = 'SELECT SUM(totalHours) AS totalHours FROM tasks WHERE year = ? AND month = ? AND day = ?';
  const values = [year, month, day];

  db.query(query, values, (err, results) => {
    if (err) {
      res.status(500).json({ error: 'Failed to fetch tasks.' });
      return;
    }

    // Extract the totalHours from the results
    const totalHours = results[0].totalHours || 0; // If no tasks found, default to 0

    res.status(200).json({ totalHours });
  });
});

app.get('/totalHours/:year/:month', (req, res) => {
  const year = req.params.year;
  const month = req.params.month;

  const query = `
   SELECT day,SUM(totalHours) AS totalHours
  FROM emp.tasks
  WHERE year = ?
  AND month= ?
  GROUP BY day
  ORDER BY day;

  `;

  db.query(query, [year, month], (err, results) => {
    if (err) {
      console.error('Error fetching data from the database:', err);
      res.status(500).send('Server error');
      return;
    }

    const totalHours = results.reduce((acc, row) => {
      acc[row.day] = row.totalHours;
      return acc;
    }, {});
    console.log(totalHours);
    res.json(totalHours);
  });
});



app.post('/add-event', (req, res) => {
  const { title, description, timeFrom, timeTo, day, month, year } = req.body;

  // Function to calculate total hours
  function calculateTotalHours(timeFrom, timeTo) {
  const [fromHour, fromMin] = timeFrom.split(":").map(Number);
  const [toHour, toMin] = timeTo.split(":").map(Number);

  const fromTime = fromHour + fromMin / 60; // Convert to decimal hours
  const toTime = toHour + toMin / 60; // Convert to decimal hours

  return toTime - fromTime;
}

const totalHours = calculateTotalHours(timeFrom,timeTo);


  if (!title || !description || !timeFrom || !timeTo || !day || !month || !year) {
    res.status(400).json({ error: 'Please provide all the required fields.' });
    return;
  }

  const query = 'INSERT INTO tasks (title, description, timeFrom, timeTo, day, month, year,totalHours) VALUES (?, ?, ?, ?, ?, ?, ?,?)';
  const values = [title, description, timeFrom, timeTo, day, month, year,totalHours];



  db.query(query, values, (err, result) => {
    if (err) {
      console.error('Error executing query:', err);
      res.status(500).json({ error: 'Failed to add the event.' });
      return;
    }
    res.status(200).json({ message: 'Event added successfully.', eventId: result.insertId, totalHours });
  });
});



// Start the server

 app.listen(PORT, () => { 
     console.log(`Server running on port: ${PORT}`); 
 });