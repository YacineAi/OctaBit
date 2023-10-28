const express = require("express");
const app = express();
const Botly = require("botly");
const axios = require("axios");
const os = require('os');
const botly = new Botly({
	accessToken: process.env.PAGE_ACCESS_TOKEN,
	notificationType: Botly.CONST.REGULAR,
	FB_URL: "https://graph.facebook.com/v2.6/",
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SB_URL, process.env.SB_KEY, { auth: { persistSession: false} });


/* ----- ESSENTIALS ----- */
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

function formatBytes(bytes) {
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 Byte";
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + " " + sizes[i];
  }
  
  app.get("/", (req, res) => {
    const memoryUsage = process.memoryUsage();
    let uptimeInSeconds = process.uptime();
  
    let uptimeString = "";
    if (uptimeInSeconds < 60) {
      uptimeString = `${uptimeInSeconds.toFixed()} seconds`;
    } else if (uptimeInSeconds < 3600) {
      uptimeString = `${(uptimeInSeconds / 60).toFixed()} minutes`;
    } else if (uptimeInSeconds < 86400) {
      uptimeString = `${(uptimeInSeconds / 3600).toFixed()} hours`;
    } else {
      uptimeString = `${(uptimeInSeconds / 86400).toFixed()} days`;
    }
  
    const osInfo = {
      totalMemoryMB: (os.totalmem() / (1024 * 1024)).toFixed(2),
      freeMemoryMB: (os.freemem() / (1024 * 1024)).toFixed(2),
      cpus: os.cpus(),
    };
  
    res.render("index", { memoryUsage, uptimeString, formatBytes, osInfo });
  });

/* ----- MAGIC ----- */
app.post('/webhook', (req, res) => {
 // console.log(req.body)
  if (req.body.message) {
    onMessage(req.body.message.sender.id, req.body.message);
  } else if (req.body.postback) {
    onPostBack(req.body.postback.message.sender.id, req.body.postback.message, req.body.postback.postback);
  }
  res.sendStatus(200);
});



/* ----- DB Qrs ----- */
async function createUser(user) {
    const { data, error } = await supabase
        .from('users')
        .insert([ user ]);
  
      if (error) {
        throw new Error('Error creating user : ', error);
      } else {
        return data
      }
  };
  
async function updateUser(id, update) {
    const { data, error } = await supabase
      .from('users')
      .update( update )
      .eq('uid', id);
  
      if (error) {
        throw new Error('Error updating user : ', error);
      } else {
        return data
      }
};
  
async function userDb(userId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('uid', userId);
  
    if (error) {
      console.error('Error checking user:', error);
    } else {
      return data
    }
};

/* ----- HANDELS ----- */

const onMessage = async (senderId, message) => {
    if (message.message.text) {
        if (message.message.text.length === 10 && !isNaN(message.message.text) && message.message.text.startsWith("07")) {
            const user = await userDb(senderId);
            if (user[0]) {
                if (user[0].step == null) {
                    botly.sendButtons({
                        id: senderId,
                        text: `هل تؤكد أن (${message.message.text}) هو رقمك 📱؟`,
                        buttons: [
                          botly.createPostbackButton("نعم ✅", `num-${message.message.text}`),
                          botly.createPostbackButton("لا ❎", "rephone")]});
                } else if (user[0].step == "activated") {

                } else if (user[0].step == "sms") {

                }
            } else {
                await createUser({uid: senderId, step: null, token: null, rtoken: null, itoken: null, lastact: null, lastsms: null})
                .then((data, error) => {
                    botly.sendButtons({
                        id: senderId,
                        text: "مرحبا بك 💜\nنوتي بايت هو بوت خاص بالجزائريين فقط 🇩🇿\nيمكنك تفعيل الـ2 جيغا المجانية من جيزي بشكل أسبوعي 😄.\nكل ماعليك هو كتابة رقمك و إتباع الخطوات ✅\nمن فضلك إذا أفادك البوت لا تنسى متابعتي على حسابي 👇🏻",
                        buttons: [
                          botly.createPostbackButton("حساب المبرمج 💻", "123")
                        ]});
                });
            }
        } else {
            botly.sendText({id: senderId, text: "يرجى إدخال أرقام جيزي فقط !📱"});
        }
      } else if (message.message.attachments[0].payload.sticker_id) {
        botly.sendText({id: senderId, text: "(Y)"});
      } else if (message.message.attachments[0].type == "image" || message.message.attachments[0].type == "audio" || message.message.attachments[0].type == "video") {
        //
      }
};
/* ----- POSTBACK ----- */

const onPostBack = async (senderId, message, postback) => {
    if (message.postback){ // Normal (buttons)
        if (postback == "GET_STARTED"){

        } else if (postback == "SetMain" || postback == "ChangeLang") {
        } else if (postback == "SetSub") {
        } else if (postback == "rephone") {
            botly.sendText({id: senderId, text: "صحا. ملا عاود ابعث رقم يكون تاعك"});
        } else if (postback.startsWith("num-")) {
            let num = postback.split("num-");
            let shp = num[1].split("0");
            try {
                const response = await axios({
                    method: "post",
                    url: "https://apim.djezzy.dz/oauth2/registration",
                    data: "scope=smsotp&client_id=6E6CwTkp8H1CyQxraPmcEJPQ7xka&msisdn=213" + shp[1],
                    headers: {
                        "accept":"*/*",
                        "accept-encoding":"gzip",
                        "connection":"Keep-Alive",
                        "content-length":"71",
                        "content-type":"application/x-www-form-urlencoded",
                        "host":"apim.djezzy.dz",
                        "user-agent":"Dalvik/2.1.0 (Linux; U; Android 7.1.2; ASUS_Z01QD Build/N2G48H)"
                    }
                  });
                  //
                  botly.sendText({id: senderId, text: "تم إرسال الرمز إلى الرقم 💬\nيرجى نسخ الرسالة 📋 أو كتابة الارقام التي وصلتك 🔢"}); 
            } catch (error) {
                botly.sendText({id: senderId, text: "خطأ"});
            }
        } 
      } else { // Quick Reply
        if (message.message.text == "tbs") {
        } else if (postback == "SetMain") {
        } else if (postback == "SetSub"){
        } else {
        }
      }
};
/* ----- HANDELS ----- */
app.listen(3000, () => console.log(`App is on port : 3000`));