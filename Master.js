/* Farmingdale Fall 2021 Capstone by Group 1
   All javascript done by Nick Thomas */

//require these modules
var http = require("http");
var fs = require("fs");
var mysql = require("mysql");
var express = require("express");
var path = require("path");
const { json } = require("express"); 
var bodyParser = require("body-parser");
const { render } = require("ejs");
var session = require("express-session");
const {v4:uuidv4} = require("uuid");

//application class variable
var app = express();

//define our config for body parser
//With this we can parse data from html inputs from the body tag
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

//set our view engine for our html templates
//this is what allows us to send dynamic data to an html file
app.set("view engine", "ejs");

//create our login session
//session is what holds live variables for login
app.use(session(
    {
        secret: uuidv4(),
        resave: false,
        saveUninitialized: true
    }
));

//Also we need to set a path to our public folder, this is where static files will be like css and images
app.use(express.static(__dirname + "/public"));

//global variables - use these to gather input alonsgide the session login
var clientResultSelection = {userNames: [], firstNames: [], lastNames: [], ages: [], genders: []};
var vendorResultSelection = {companyNames: [], States: [], Cities: [], Professions: [], Phones: []};
var searchResult = {companyNames: [], States: [], Cities: [], Profession1: [], Phones: []};
// [] is useable as an unbounded array size, and this { defines properties }
var searchQuery = false;

//global functions
function ClearData(data)
{
    //I can prob use a property that lets me clear each array but I'll keep it simple for now
    for(var x=0; x<data.length; x++)
    {
        //can use delete keyword for this
        delete data[x];
    }
}

//connect to our mySQL local Database, using a pool allows use to have multiple connections running simutaneaously
var con = mysql.createPool(
{
    connectionLimit : 100,
    host: "localhost",
    user: "root",
    password: "password",
    database: "world"
});

//These must be gathered out side the HTMl Render as render is sync if done in the same get statement
//runs again after redirect
//SELECTION Statements From Database 
con.getConnection(function(err, connection)
{
    if(err) throw err;

    //in the future this might want to be a more lax query, consider doing chunks and requering on the page
    var sqlSelect = "SELECT * FROM ClientAccounts";
    connection.query(sqlSelect,function(err, result, fields)
    {
        if(err) throw err;

        //test the select statement as a whole
        //console.log(result);
        //console.log(typeof result.FirstName);

        for(var x=0; x<result.length; x++) 
        {
            //use parse-stringify to remove "" when outputting the data
            var temp = JSON.parse(JSON.stringify(result[x].ClientUserName));
            clientResultSelection.userNames[x] = temp;
            console.log(temp);
            console.log(typeof temp);

            temp = JSON.stringify(result[x].FirstName);
            clientResultSelection.firstNames[x] = temp;

            temp = JSON.stringify(result[x].LastName);
            clientResultSelection.lastNames[x] = temp;

            temp = JSON.stringify(result[x].Age);
            clientResultSelection.ages[x] = temp;

            temp = JSON.stringify(result[x].Gender);
            clientResultSelection.genders[x] = temp;
            
            //console.log("Grabbed element: " + resultList[x]);
        }
        console.log("grabbed all data from db::From Function get--UserList");
    });

    //grab the vendors here as well since we have the pooling we are fine here
    connection.query("SELECT * FROM VendorAccounts", function(err, result, fields)
    {
        if(err) throw err;

        console.log("Grabbing data from vendors for the handy-dashboard");
        for(var x=0; x<result.length; x++)
        {
            vendorResultSelection.companyNames[x] = JSON.parse(JSON.stringify(result[x].CompanyName));
            vendorResultSelection.States[x] = JSON.parse(JSON.stringify(result[x].State));
            vendorResultSelection.Cities[x] = JSON.parse(JSON.stringify(result[x].City));
            vendorResultSelection.Professions[x] = JSON.parse(JSON.stringify(result[x].Profession1));
            vendorResultSelection.Phones[x] = JSON.parse(JSON.stringify(result[x].Phone));
        }
    });
    
    console.log("Vendors gathered");
    //release the connection back into the pool
    connection.release();
});


//GET Statements
//app.get is for defining the page routes for multiple pages
app.get("/UserCreation", function(req, res)
{
    res.render("UserAccountCreation",
    {
        user: req.session.user
    });
});

app.get("/UserLogin", function(req, res)
{
    res.render("UserLogin",
    {
        user: req.session.user
    });
});

app.get("/Home", function(req, res)
{
    //this is the page where vendors can be searched and filtered

    res.render("HomeAndSearch", 
    {
        doQuery: searchQuery, 
        queryResult: searchResult.companyNames,
        user: req.session.user
    });
});

app.get("/VendorCreation", function(req, res)
{
    res.render("VendorAccountCreation",
    {
        user: req.session.user
    });
});

app.get("/UserLogout", function(req, res)
{
    //destroy resets the session variables
    req.session.destroy(function(err)
    {
        //callback function that checks for an error
        if(err)
        {
            console.log(err);
            res.send(err);
        }
        else
        {
            console.log("Logged Out-")
            res.render("UserLogin", {logout: "You are now logged out"});
        }
    });
});

//keep these are the end - i don't want to deal with callbacks if I don't have to
app.get("/UserList", function(req, res)
{
    res.render("UserAccountList", 
    {
        userData: clientResultSelection.userNames, 
        user : req.session.user 
    });
});

app.get("/VendorList", function(req, res)
{
    //console.log(vendorResultSelection.companyNames[0]);
    res.render("VendorAccountList_Dashboard", 
    {
        vendorData: vendorResultSelection.companyNames,
        user : req.session.user
    });
});

//POST STATEMENTS
//For pages that submit data we append .Pose method for them
app.post("/UserCreation", function(req, res)
{
    //body parser is needed here inorder to get information from the html file
    var username = req.body.username; //these grab the id of the input fields
    var userPassword = req.body.userPassword;
    var firstName = req.body.firstName;
    var lastName = req.body.lastName;
    var age = req.body.age;
    var gender = req.body.gender;
    console.log(typeof username);
    console.log("Sending the infomation (Pending): " 
    + username + ", " + userPassword + ", " + firstName + ", " + lastName + ", " + age + ", " + gender);

    //pass to the array so we don't have to requery again
    clientResultSelection.userNames.push(username);
    
    //add try catch here for the UNIQUE contraints and other SQL errors
    con.getConnection(function(err, connection)
    {
        if(err) throw err;

        var sqlInsert = "INSERT INTO clientaccounts (ClientUserName, ClientPassword, FirstName, LastName, Age, Gender) VALUES";
        var values = "('"+username+"', '"+userPassword+"', '"+firstName+"', '"+lastName+"', '"+age+"', '"+gender+"')";
        connection.query(sqlInsert + values, function(err, result)
        {
            if(err) throw err;
            console.log("The values have been submitted to the database");
        });
        
        //release the connection
        connection.release();
    });
    
    //clear the buffer
    username, userPassword, firstName, lastName, age, gender = null;

    //redirect to another page
    res.redirect("/UserList");
});

app.post("/VendorCreation", function(req,res)
{   
    var venUsername = req.body.Vusername; //these grab the id of the input fields
    var venPassword = req.body.VPassword;
    var Company = req.body.companyName;
    var State = req.body.state;
    var City = req.body.city;
    var pro1 = req.body.profession1;
    var PhoneNO = req.body.phone;
    console.log("Sending the infomation (Pending): " 
    + venUsername + ", " + venPassword + ", " + Company + ", " + State+ ", " + City + ", " + pro1 + ", " + PhoneNO);

    //console.log(Company);
    //pass to the array so we don't have to requery again
    vendorResultSelection.companyNames.push(Company);
    
    //add try catch here for the UNIQUE contraints and other SQL errors
    con.getConnection(function(err, connection)
    {
        if(err) throw err;

        var sqlInsert = "INSERT INTO vendoraccounts (VendorUserName, VendorPassword, CompanyName, State, City, Profession1, Phone)";
        var values = "VALUES ('"+venUsername+"', '"+venPassword+"', '"+Company+"', '"+State+"', '"+City+"', '"+pro1+"', '"+PhoneNO+"')";
        connection.query(sqlInsert + values, function(err, result)
        {
            if(err) throw err;
            console.log("The values have been submitted to the database");
        });
        
        //release the connection
        connection.release();
    });
    
    //clear the buffer

    //redirect to another page
    res.redirect("/VendorList");
});

app.post("/UserLogin", function(req, res)
{
    console.log("UserLogin Post-");
    var Cusername, Cpassword, SQLuser, SQLpass;

    //var test = req.body.username;
    //console.log(test);
    //grab the input from the login form using the body parser
    Cusername = req.body.username;
    Cpassword = req.body.password;

    console.log("Grabbed from form submit- " + Cusername + " " + Cpassword);
    

    //check if there is an existing account with that username and password with a where statement
    con.getConnection(function(err, connection)
    {
        if(err) throw err;

        var whereUser = "SELECT * FROM clientaccounts WHERE ClientUserName = '" + Cusername + "'";
        var wherePass = " AND ClientPassword = '" + Cpassword + "'";
        
        connection.query(whereUser + wherePass, function (err, result, fields)
        {
            if(err) throw err;

            
            console.log("After query" + result[0].ClientUserName + result[0].ClientPassword);
            //grab the query result
            //We actually need a temp here, because by defualt it's passing it by Reference? 
            SQLuser = JSON.parse(JSON.stringify(result[0].ClientUserName))
            SQLpass = JSON.parse(JSON.stringify(result[0].ClientPassword));
            console.log("Grabbed account from database " + SQLuser + "|" + SQLpass);

            //await WaitForValue(SQLuser, temp1);
            //await WaitForValue(SQLpass, temp2);   
            
            //try inside here IT WORKS
            console.log("In the query callback");
            if(Cusername == SQLuser && Cpassword == SQLpass)
            {
                console.log("If Logged!_ LOGIN SUCESSFUL");
                req.session.user = SQLuser;
                //res.end("Login Successfull!!");
                res.redirect("/UserList");
            }
            else
            {
                console.log("[" + Cusername + "]["+SQLuser+"]["+SQLpass);
                console.log("login failed-Check authentication condition");
                res.end("login Failed");
            }
        });

        //I AM IN CALLBACK HELL- PLEASE GOD HELP
        //start the session with the logged in user
        //release the connection
        connection.release();
    }); 

});

app.post("/Home", function(req,res)
{
    //post method for the search bar
    //grab data from the body
    var textSearch = req.body.searchbar;
    var proSelect = req.body.professionChoice;
    console.log("start search: " + textSearch + " " + proSelect);

    //make sure to clear the search results from lasttime
    ClearData(searchResult.companyNames)
    ClearData(searchResult.Profession1);
    ClearData(searchResult.Phones);

    //set the query into place
    con.getConnection(function(err, connection)
    {
        if(err) throw err;

        //define the sql statement - make use of the % wildcards
        var searchSelect = "SELECT * FROM VendorAccounts WHERE UPPER(CompanyName) LIKE UPPER('%"+textSearch+"%')";
        var menuSelect = " AND UPPER(Profession1) LIKE UPPER('%" + proSelect + "%')";

        //now query for the results
        //console.log("starting Query");
        connection.query(searchSelect+menuSelect, function(err, result, fields)
        {
            console.log("inside Query " + result.length);
            //if(err) throw err;
            for(var x=0; x<result.length; x++)
            {
                //grab the results into the extra variable for search
                //console.log("grabbing results from home query");
                searchResult.companyNames[x] = JSON.parse(JSON.stringify(result[x].CompanyName));
                searchResult.Profession1[x] = JSON.parse(JSON.stringify(result[x].Profession1));
                searchResult.Phones[x] = JSON.parse(JSON.stringify(result[x].Phone));
                //console.log("Search Query Grabbed");
            }
            //do the rest of the work in here since its already a callback
            //remember to set doQuery
            searchQuery = true;
            //redirect to itself once the data is gathered
            res.redirect("back");
        });

    });
});
//Listener always goes on the bottom
app.listen(3000)
console.log("Currently listening to port 3000");