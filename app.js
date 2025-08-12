// Copyright 2017 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Default entry point for App Engine Node.js runtime. Defines a
 * web service which returns the mapid to be used by clients to display map
 * tiles showing slope computed in real time from SRTM DEM data. See
 * accompanying README file for instructions on how to set up authentication.
 */
const admins = ['pisut.nakmuenwai@gmail.com'];

("use strict");
const path = require("path");
const exec = require('child_process').exec;
const { platform } = require('os');
//-----------------------------------------
const fs = require('fs').promises;
const process = require('process');

// Import the Google Cloud client library
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');
const { BigQuery } = require('@google-cloud/bigquery');
const bigquery = new BigQuery({
    projectId: 'muen-app',
});
//BigQuery Token with 
//> gcloud auth application-default login


// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'config/client_secret_507007960929-r6vq0588k5b6bttg9gv6e91jtjvhl0cn.apps.googleusercontent.com.json');

//-----------------------------------------
function isNumeric(str) {
    if (typeof str != "string") return false // we only process strings!  
    return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
        !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
}
//-----------------------------------------
//const ee = require("@google/earthengine");
//const privateKey = require("./System/watkaonoi-964fc4de4261.json");

// [START gae_flex_quickstart]
const express = require("express");
var parserBody = require("body-parser");
const { error, info } = require("console");

// RAW POST BODY
var parserPDF = parserBody.raw({
    limit: "50mb",
    extended: true,
    type: "application/pdf",
});
// RAW POST BODY
var parserRAW = parserBody.raw({
    limit: "50mb",
    extended: true,
});
// JSON POST BODY
var parserJSON = parserBody.json({
    limit: "50mb",
    extended: true,
});
// URL GET KVP
var parserURL = parserBody.urlencoded({
    limit: "50mb",
    extended: false,
    parameterLimit: 50000,
});

const secure = function (req, res, next) {
    if (req.protocol === 'http' && req.headers.host.indexOf('localhost') < 0) {
        res.redirect(301, `https://${req.hostname}:${req.PORT}${req.url}`);
        return;
    } else {
        next();
    }
}

function parseJwt(token) {
    var base64Url = token.split(".")[1];
    var base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    //console.log(Buffer.from('Hello World!').toString('base64'));
    //console.log(Buffer.from(b64Encoded, 'base64').toString());
    var jsonPayload = decodeURIComponent(
        Buffer.from(base64, 'base64').toString()
            .split("")
            .map(function (c) {
                return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
            })
            .join("")
    );
    console.log(jsonPayload);
    return JSON.parse(jsonPayload);
}

const toBase64 = (base64url) => (
    base64url
        .replace(/-/g, '+')
        .replace(/_/g, '/')
);
const fromBase64 = (base64) => (
    base64
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
);
//---------------------------------------

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
    try {
        const content = await fs.readFile(TOKEN_PATH);
        const credentials = JSON.parse(content);
        return google.auth.fromJSON(credentials);
    } catch (err) {
        return null;
    }
}

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
    const content = await fs.readFile(CREDENTIALS_PATH);
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
    });
    await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
    let client = await loadSavedCredentialsIfExist();
    if (client) {
        return client;
    }
    client = await authenticate({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
        await saveCredentials(client);
    }
    return client;
}

/**
 * Prints the names and majors of students in a sample spreadsheet:
 * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
async function listMajors(auth) {
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: '19JJYBzExquS0rIl7GJnvyb3lvQ9r1x_FJ7o7c-oc-hU',
        range: 'Class Data!A2:E',
    });
    const rows = res.data.values;
    if (!rows || rows.length === 0) {
        console.log('No data found.');
        return;
    }
    console.log('Name, Major:');
    rows.forEach((row) => {
        // Print columns A and E, which correspond to indices 0 and 4.
        console.log(`${row[0]}, ${row[4]}`);
    });
}

//=====================================================================
/* GCloud Authen
authorize().then(WebApp).catch(console.error);
*/
WebApp();

function WebApp(client) {
    const jwt = require("jsonwebtoken");
    const app = express();
    //app.use(secure); //not work
    app.use(parserPDF);
    app.use(parserRAW);
    app.use(parserJSON);
    app.use(parserURL);
    //npm install --save body-parser multer
    var multer = require("multer");
    const { checkPrimeSync, verify } = require("crypto");
    var upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } });
    //app.use(upload.array());

    //////////////////////////////////////////////////////
    /*                    Main Content                  */
    //////////////////////////////////////////////////////
    app.use("/js", express.static("js"));
    app.use("/css", express.static("css"));
    app.use("/fonts", express.static("fonts"));
    app.use("/img", express.static("img"));
    app.use("/images", express.static("images"));
    app.use("/videos", express.static("videos"));
    app.use("/regulation", express.static("regulation"));

    app.get("/", (req, res) => {
        //res.status(200).send('Hello, world!').end();
        //res.setHeader("Cross-Origin-Opener-Policy", "same-origin allow-popups");
        res.sendFile(path.join(__dirname, 'index.html'));
    });
    app.get("/*\.html$/", (req, res) => {
        res.sendFile(path.join(__dirname, req.path), { headers: { "Content-Type": "text/html" } });
    });
    app.get("/*\.css$/", (req, res) => {
        res.sendFile(path.join(__dirname, req.path), { headers: { "Content-Type": "text/css" } });
    });
    app.get("/*\.js$/", (req, res) => {
        res.sendFile(path.join(__dirname, req.path), { headers: { "Content-Type": "text/javascript" } });
    });
    app.get("/*\.ico$/", (req, res) => {
        res.sendFile(path.join(__dirname, req.path), { headers: { "Content-Type": "image/vnd.microsoft.icon" } });
    });

    //////////////////////////////////////////////////////
    /*                    Dynamic Content               */
    //////////////////////////////////////////////////////

    const PORT = parseInt(process.env.PORT) || 9999;

    let Listening = false;
    app.listen(PORT, () => {
        console.log(`App listening on port ${PORT}`);
        console.log("Press Ctrl+C to quit.");
    });
    console.log(`Listening on port ${PORT}`);

    if (PORT == 9999) {
        let os = platform()
        let url = "http://localhost:9999";
        if (os === 'win32') {
            //command = `start microsoft-edge:${url}`;
            command = `start chrome ${url}`;
        } else if (os === 'darwin') {
            command = `open -a "Google Chrome" ${url}`;
        } else {
            command = `google-chrome --no-sandbox ${url}`;
        }
        console.log(`executing command: ${command}`);
        try {
            exec(command);
        } catch (error) {
            console.log(error);
        }
    }
    /*
    app.use('/admin', function (req, res, next) { // GET 'http://www.example.com/admin/new?a=b'
      console.dir(req.originalUrl) // '/admin/new?a=b' (WARNING: beware query string)
      console.dir(req.baseUrl) // '/admin'
      console.dir(req.path) // '/new'
      console.dir(req.baseUrl + req.path) // '/admin/new' (full path without query string)
      next()
    });
    */
    app.use('/checkid', async function (req, res, next) { //verifyToken
        try {
            //console.log(req.body);
            if (req.body.id) {
                let info = await getUserInfo(req.body.id);
                console.log(info);
                let authen = {};
                authen.info = null
                authen.success = info.success;
                authen.error = info.error;
                if (info.success && info.result) {
                    authen.info = { FullNameEng: info.result.FullNameEng };
                }
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(authen));
                next();
            } else {
                return res.status(403).json({ success: false, error: "Student ID is inv" });
            }
        } catch (error) {
            return res.status(403).json({ success: false, error: error.message });
        }

    });


    app.use('/authen', async function (req, res, next) { //verifyToken
        const token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : false; // ดึง Token จาก Header
        if (!token) return res.status(401).json({ success: false, error: "Unauthorized" });
        /*
        //https://www.borntodev.com/2023/11/01/การใช้งาน-jwt-json-web-tokelns-ในการ-authentication/
        //jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        jwt.verify(token, secret, (err, decoded) => {
            if (err) return res.status(403).json({ message: "Forbidden" });
            req.user = decoded; // แนบข้อมูลผู้ใช้ไปยัง req
            next();
        });
        */
        try {
            let authen = parseJwt(token);
            console.log(authen);
            console.log(req.body);
            if (authen.email && (admins.includes(authen.email) ||
                authen.email.endsWith('@gmail.com') ||
                authen.email.endsWith('@mahidol.ac.th') ||
                authen.email.endsWith('@student.mahidol.edu') ||
                authen.email.endsWith('@student.mahidol.ac.th'))) {
                let info;
                if (admins.includes(authen.email)) {
                    if (req.body.as && isNumeric(req.body.as) && req.body.as.length == 7) {
                        console.log(req.originalUrl);
                        console.log(req.body.as)
                        //fake authen as other user
                        info = await getUserInfo(req.body.as);
                    } else {
                        info = { success: true, result: {}, group: 'Administrator' };
                    }
                } else {
                    info = await getUserInfo(authen.email.replace('mahidol.edu', 'mahidol.ac.th'));
                }
                console.log(info);
                authen.success = info.success;
                authen.error = info.error;
                if (info.success && info.result) {
                    authen.info = info.result || {};
                    authen.info.group = 'Student';
                }
                if (info.group) {
                    authen.info.group = info.group;
                }
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(authen));
                next();
            } else {
                return res.status(403).json({ success: false, error: "Forbidden - We area accepted email only @mahidol" });
            }
        } catch (error) {
            return res.status(403).json({ success: false, error: error.message });
        }

    });
    app.use('/register', async function (req, res, next) { //verifyToken
        const token = req.headers.authorization ? req.headers.authorization.split(" ")[1] : false; // ดึง Token จาก Header
        if (!token) return res.status(401).json({ success: false, error: "Unauthorized" });
        /*
        //https://www.borntodev.com/2023/11/01/การใช้งาน-jwt-json-web-tokelns-ในการ-authentication/
        //jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        jwt.verify(token, secret, (err, decoded) => {
            if (err) return res.status(403).json({ message: "Forbidden" });
            req.user = decoded; // แนบข้อมูลผู้ใช้ไปยัง req
            next();
        });
        */
        try {
            let authen = parseJwt(token);
            console.log(authen);
            console.log(req);
            if (!req.body.id) {
                return res.status(403).json({ success: false, error: "Student ID is invalid" });

            }
            let info = await setUserGMail(req.body.id, authen.email);
            console.log(info);
            authen.info = null;
            authen.success = info.success;
            authen.error = info.error;
            if (info.success && info.result) {
                authen.info = info.result || {};
                authen.info.group = 'Student';
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(authen));
            next();

        } catch (error) {
            return res.status(403).json({ success: false, error: error.message });
        }

    });
}

async function getUserInfo(email) {
    // Queries the U.S. given names dataset for the state of Texas.
    // For all options, see https://cloud.google.com/bigquery/docs/reference/rest/v2/jobs/query
    try {

        let query = '';
        let group = 'Student';
        if (isNumeric(email) && email.length == 7) {
            query = `SELECT * FROM \`muen-app.muen.Student\` WHERE \`ID\` = ${email} LIMIT 1`;
        } else if (email.includes('@student.')) {
            query = `SELECT * FROM \`muen-app.muen.Student\` WHERE \`Email\` = '${email}' LIMIT 1`;
        } else if (email.includes('@gmail.com')) {
            query = `SELECT * FROM \`muen-app.muen.Student\` WHERE \`GMail\` = '${email}' LIMIT 1`;
        } else {
            query = `SELECT * FROM \`muen-app.muen.Admin\` WHERE \`Email\` = '${email}' LIMIT 1`;
            group = 'Lecturer';
        }
        const options = {
            //location: 'asia-southeast1',
            query: query,
        };
        console.log(options);

        // Run the query as a job
        const [job] = await bigquery.createQueryJob(options);
        console.log(`Job ${job.id} started.`);

        // Wait for the query to finish
        const [rows] = await job.getQueryResults();
        //rows.forEach(row => console.log(row));
        if (rows.length == 0) {
            return { success: false, result: null, error: "User Not found" };
        } else {
            return { success: true, result: rows[0] };
        }
    } catch (error) {
        return { success: false, result: null, error: error.message };
    }
}


async function setUserGMail(id, email) {
    // Queries the U.S. given names dataset for the state of Texas.
    // For all options, see https://cloud.google.com/bigquery/docs/reference/rest/v2/jobs/query
    try {
        if (isNumeric(id) && id.length == 7) {
            let query = `UPDATE \`muen-app.muen.Student\`
                            SET \`GMail\` = '${email}'
                            WHERE \`ID\` = ${id}`;
            const options = {
                //location: 'asia-southeast1',
                query: query,
            };
            console.log(options);

            // Run the query as a job
            const [job] = await bigquery.createQueryJob(options);
            console.log(`Job ${job.id} started.`);

            // Wait for the query to finish
            const [rows] = await job.getQueryResults();
            //rows.forEach(row => console.log(row));
            return { success: true, result: { ID: id, GMail: email } };

        } else {
            return { success: false, result: null, error: "Student ID is invalid" };
        }

    } catch (error) {
        return { success: false, result: null, error: error.message };
    }
}

async function getStatistics() {
    // Queries the U.S. given names dataset for the state of Texas.
    // For all options, see https://cloud.google.com/bigquery/docs/reference/rest/v2/jobs/query
    try {
        let query = `SELECT sum(Pass) as Pass, 
            sum(Count) as Count, round((sum(Pass)/sum(Count))*100,2) as Percent 
            FROM \`muen-app.muen.EnglishPercent\` LIMIT 1`;
        const options = {
            //location: 'asia-southeast1',
            query: query,
        };

        // Run the query as a job
        const [job] = await bigquery.createQueryJob(options);
        console.log(`Job ${job.id} started.`);

        // Wait for the query to finish
        const [rows] = await job.getQueryResults();
        //rows.forEach(row => console.log(row));
        return rows;

    } catch (error) {
        return error;
    }
}