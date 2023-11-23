const express = require("express");
const app = express();
const Botly = require("botly");
const axios = require("axios");
const os = require('os');
const https = require('https');
const { SocksProxyAgent } = require("socks-proxy-agent");
const botly = new Botly({
	accessToken: process.env.PAGE_ACCESS_TOKEN,
	notificationType: Botly.CONST.REGULAR,
	FB_URL: "https://graph.facebook.com/v2.6/",
});


const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SB_URL, process.env.SB_KEY, { auth: { persistSession: false} });

const twoGb = {"data":{"id":"GIFTWALKWIN","type":"products","meta":{"services":{"steps":10000,"code":"GIFTWALKWIN2GO","id":"WALKWIN"}}}};
const foreGb = {"data":{"id":"GIFTWALKWIN","type":"products","meta":{"services":{"steps":15000,"code":"GIFTWALKWIN4GO","id":"WALKWIN"}}}};
const fiveGb = {"data":{"id":"GIFTWALKWIN","type":"products","meta":{"services":{"steps":33570816,"code":"GIFTWALKWIN6GOWEEK","id":"WALKWIN"}}}};

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

app.get('/ping', (req, res) => {
  res.status(200).json({ message: 'Ping successful' });
});

function keepAppRunning() {
  setInterval(() => {
    https.get(`${process.env.RENDER_EXTERNAL_URL}/ping`, (resp) => {
      if (resp.statusCode === 200) {
        console.log('Ping successful');
      } else {
        console.error('Ping failed');
      }
    });
  }, 5 * 60 * 1000); // 5 minutes in milliseconds
}

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
  let proxies = await axios.get(process.env.ProxyAPI);
  let types = ["FR"];
  let filteredArr = proxies.data.filter(function (item) {
    return types.includes(item.country);
  });
  let randomIndex = Math.floor(Math.random() * filteredArr.length);
  let randomObject = filteredArr[randomIndex];
  let proxy = "socks5://" + `${randomObject.ip}:${randomObject.port}`;
  let httpsAgent = new SocksProxyAgent(proxy, { timeout: 5000 });
  const timeNow = new Date().getTime();
    if (message.message.text) {
      const user = await userDb(senderId);
      if (user[0]) {
        if (user[0].step == null) {
          var numbers = message.message.text.match(/\d+/g);
          if (numbers) {
            var numberString = numbers.join('');
            if (numberString.length === 10 && !isNaN(numberString) && numberString.startsWith("07")) {
              botly.sendButtons({
                id: senderId,
                text: `هل تؤكد أن (${numberString}) هو رقمك 📱؟`,
                buttons: [
                  botly.createPostbackButton("نعم ✅", `num-${numberString}`),
                  botly.createPostbackButton("لا ❎", "rephone")]});
            } else {
              botly.sendText({id: senderId, text: "يرجى إدخال أرقام جيزي فقط !📱"});
            }
          } else {
            botly.sendText({id: senderId, text: "يرجى إدخال أرقام جيزي فقط !📱"});
          }
        } else if (user[0].step == "sms") {
          if (message.message.text.startsWith("Verification Code")) {
            const regex = /Verification Code : (\d+)\./;
            const match = message.message.text.match(regex);
            if (user[0].lastsms > timeNow) {
              try {
                const otp = await axios({
                  method: "post",
                  url: "https://apim.djezzy.dz/oauth2/token",
                  data: `scope=openid&client_secret=MVpXHW_ImuMsxKIwrJpoVVMHjRsa&client_id=6E6CwTkp8H1CyQxraPmcEJPQ7xka&otp=${match[1]}&mobileNumber=213${user[0].num}&grant_type=mobile`,
                  headers: { "content-type":"application/x-www-form-urlencoded", },
                  httpsAgent: httpsAgent,
                });

                if (otp.data.access_token != undefined) {
                  await updateUser(senderId, {step: null , lastsms: null})
                  .then(async (data, error) => {
                    if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                    const headers = { 'Authorization': `Bearer ${otp.data.access_token}`, };
                    try {
                      const succ2Gb = await axios({
                        method: "post",
                        url: `https://apim.djezzy.dz/djezzy-api/api/v1/subscribers/213${user[0].num}/subscription-product?include=`,
                        data: twoGb,
                        headers: headers,
                        httpsAgent: httpsAgent,
                      });
                      if (succ2Gb.data.status == 200) {
                        await updateUser(senderId, {step: null, lastsms : null})
                      .then((data, error) => {
                        if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                        botly.sendButtons({
                          id: senderId,
                          text: "تم تفعيل الـ2 جيغا بنجاح 🥳✅\nلا تنسى متابعة مطور الصفحة 😁👇🏻",
                          buttons: [
                            botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                          ]});
                      });
                      } else {
                        // no 200
                      }
                    } catch (error) {
                      if (error.response.status == 429) {
                        botly.sendText({id: senderId, text: "4⃣2️⃣9️⃣❗\nالكثير من الطلبات 😷 يرجى الانتظار قليلا..."});
                      } else if (error.response.status == 401) {
                        await updateUser(senderId, {step: null, lastsms : null})
                        .then((data, error) => {
                          if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                          botly.sendText({id: senderId, text: "حدث خطأ! 🤕\nيبدو أنك إستعملت الخدمة هذا الاسبوع يرجى إنتظار ايام حتى يمكنك إعادة تفعيل الخدمة ✅"});
                        });
                      } else if (error.response.status == 403) {
                        await updateUser(senderId, {step: null, lastsms : null})
                        .then((data, error) => {
                          if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                          botly.sendText({id: senderId, text: "يرجى إنتظار 30 دقيقة و إعادة المحاولة"});
                        });
                      } else if (error.response.status == 404) {
                        console.log("404 :", error.response.data)
                      } else if (error.response.status == 444) {
                      } else {
                        console.log("40x :", error.response.data)
                      }
                    }
                  });
                } else {
                  console.log("other otp: ", otp.data)
                }
              } catch (error) {
                if (error.response.status == 429) {
                  botly.sendText({id: senderId, text: "4⃣2️⃣9️⃣❗\nالكثير من الطلبات 😷 يرجى الانتظار قليلا..."});
                } else {
                  console.log("other err: ", error.response.data)
                }
              }
            } else {
              botly.sendButtons({
                id: senderId,
                text: "إنتهى وقت إدخال الرمز 🕜\nيرجى تغيير الرقم أو إعادة ارسال الرمز 📱",
                buttons: [
                  botly.createPostbackButton("إرسال رمز 📱", "resend"),
                  botly.createPostbackButton("إلغاء العملية ❎", "cancel")
                ]});
            }
          } else if (message.message.text.length === 6 && !isNaN(message.message.text)) {
            if (user[0].lastsms > timeNow) {
            try {
              const otp = await axios({
                method: "post",
                url: "https://apim.djezzy.dz/oauth2/token",
                data: `scope=openid&client_secret=MVpXHW_ImuMsxKIwrJpoVVMHjRsa&client_id=6E6CwTkp8H1CyQxraPmcEJPQ7xka&otp=${message.message.text}&mobileNumber=213${user[0].num}&grant_type=mobile`,
                headers: { "content-type":"application/x-www-form-urlencoded", },
                httpsAgent: httpsAgent,
              });

              if (otp.data.access_token != undefined) {
                console.log("Token : ", otp.data.access_token)
                await updateUser(senderId, {step: null , lastsms: null})
                  .then(async (data, error) => {
                    if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                    const headers = { 'Authorization': `Bearer ${otp.data.access_token}`, };
                    try {
                      const succ2Gb = await axios({
                        method: "post",
                        url: `https://apim.djezzy.dz/djezzy-api/api/v1/subscribers/213${user[0].num}/subscription-product?include=`,
                        data: twoGb,
                        headers: headers,
                        httpsAgent: httpsAgent,
                      });
                      if (succ2Gb.data.status == 200) {
                        await updateUser(senderId, {step: null, lastsms : null})
                      .then((data, error) => {
                        if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                        botly.sendButtons({
                          id: senderId,
                          text: "تم تفعيل الـ2 جيغا بنجاح 🥳✅\nلا تنسى متابعة مطور الصفحة 😁👇🏻",
                          buttons: [
                            botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                          ]});
                      });
                      } else {
                        // no 200
                      }
                    } catch (error) {
                      if (error.response.status == 429) {
                        botly.sendText({id: senderId, text: "4⃣2️⃣9️⃣❗\nالكثير من الطلبات 😷 يرجى الانتظار قليلا..."});
                      } else if (error.response.status == 401) {
                        await updateUser(senderId, {step: null, lastsms : null})
                        .then((data, error) => {
                          if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                          botly.sendText({id: senderId, text: "حدث خطأ! 🤕\nيبدو أنك إستعملت الخدمة هذا الاسبوع يرجى إنتظار ايام حتى يمكنك إعادة تفعيل الخدمة ✅"});
                        });
                      } else if (error.response.status == 403) {
                        await updateUser(senderId, {step: null, lastsms : null})
                        .then((data, error) => {
                          if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                          botly.sendText({id: senderId, text: "يرجى إنتظار 30 دقيقة و إعادة المحاولة"});
                        });
                      } else if (error.response.status == 404) {
                        console.log("404 :", error.response.data)
                      } else if (error.response.status == 444) {
                      } else {
                        console.log("40x :", error.response.data)
                      }
                    }
                  });
              } else {
                console.log("other otp: ", otp.data)
              }
            } catch (error) {
              if (error.response.status == 429) {
                botly.sendText({id: senderId, text: "4⃣2️⃣9️⃣❗\nالكثير من الطلبات 😷 يرجى الانتظار قليلا..."});
              } else {
                console.log("other err: ", error.response.data)
              }
            }
          } else {
            botly.sendButtons({
              id: senderId,
              text: "إنتهى وقت إدخال الرمز 🕜\nيرجى تغيير الرقم أو إعادة ارسال الرمز 📱",
              buttons: [
                botly.createPostbackButton("إرسال رمز 📱", "resend"),
                botly.createPostbackButton("إلغاء العملية ❎", "cancel")
              ]});
          }
          } else {
            if (user[0].lastsms > timeNow) {
              botly.sendButtons({
                id: senderId,
                text: "يرجى كتابة الرمز المتكون من 6 أرقام الذي وصلك 📱",
                buttons: [
                  botly.createPostbackButton("إلغاء العملية ❎", "cancel")
                ]});
            } else {
              botly.sendButtons({
                id: senderId,
                text: "إنتهى وقت إدخال الرمز 🕜\nيرجى تغيير الرقم أو إعادة ارسال الرمز 📱",
                buttons: [
                  botly.createPostbackButton("إرسال رمز 📱", "resend"),
                  botly.createPostbackButton("إلغاء العملية ❎", "cancel")
                ]});
            }
          }
        }
        } else {
                await createUser({uid: senderId, step: null, num: null, token: null, rtoken: null, itoken: null, lastact: null, lastsms: null})
                .then((data, error) => {
                    botly.sendButtons({
                        id: senderId,
                        text: "مرحبا بك 💜\nنوتي بايت هو بوت خاص بالجزائريين فقط 🇩🇿\nيمكنك تفعيل الـ2 جيغا المجانية من جيزي بشكل أسبوعي 😄.\nكل ماعليك هو كتابة رقمك و إتباع الخطوات ✅\nمن فضلك إذا أفادك البوت لا تنسى متابعتي على حسابي 👇🏻",
                        buttons: [
                          botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                        ]});
                });
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

        } else if (postback == "resend") {
          const user = await userDb(senderId);
          if (user[0].step == null) {
            botly.sendText({id: senderId, text: "عملية غير مقبولة ❗️. يرجى التسجيل بالرقم أولا 📱"});
          } else {
              var reget = async function () {
                try {
                let proxies = await axios.get(process.env.ProxyAPI);
                let types = ["FR"];
                let filteredArr = proxies.data.filter(function (item) {
                  return types.includes(item.country);
                });
                let randomIndex = Math.floor(Math.random() * filteredArr.length);
                let randomObject = filteredArr[randomIndex];
                let proxy = "socks5://" + `${randomObject.ip}:${randomObject.port}`;
                let httpsAgent = new SocksProxyAgent(proxy, { timeout: 5000 });
                const timeNow = new Date().getTime();
                const user = await userDb(senderId);
                if (user[0].lastsms == null && user[0].num != null || user[0].lastsms < timeNow && user[0].num != null) {
                const response = await axios({
                  method: "post",
                  url: "https://apim.djezzy.dz/oauth2/registration",
                  data: "scope=smsotp&client_id=6E6CwTkp8H1CyQxraPmcEJPQ7xka&msisdn=213" + user[0].num,
                  headers: {
                      "content-type":"application/x-www-form-urlencoded",
                  },
                  httpsAgent: httpsAgent,
                });
                if (response.data.status == 200) {
                  const smsTimer = new Date().getTime() + 2 * 60 * 1000;
                  await updateUser(senderId, {step: "sms", lastsms :smsTimer})
                  .then((data, error) => {
                    if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                    botly.sendText({id: senderId, text: "تم إرسال الرمز إلى الرقم 💬\nيرجى نسخ الرسالة 📋 أو كتابة الارقام التي وصلتك 🔢"});
                  });
                } else {

                }
              } else {
                botly.sendText({id: senderId, text: "انتظر قليلا حتى يمكنك ارسال رمز جديد"});
              }
            } catch (error) {
              console.log("err code: ", error.code)
              console.log("err response: ", error.response.status)
              if (error.code) {
                if (error.code == "ETIMEOUT") {
                  console.log("Proxy fail Retrying...")
                  reget();
                } else {
                  console.log("other err code: ", error.code)
                }
              } else if (error.response) {
                if (error.response.status == 429) {
                  botly.sendText({id: senderId, text: "4⃣2️⃣9️⃣❗\nالكثير من الطلبات 😷 يرجى الانتظار قليلا..."});
                } else {
                  console.log("other err response: ", error.response.data)
                }
              }
            }
          }
          reget();
        }
        } else if (postback == "cancel") {
          await updateUser(senderId, {step: null, num: null, token: null, rtoken: null, itoken: null, lastact: null, lastsms: null})
                  .then((data, error) => {
                    if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                    botly.sendText({id: senderId, text: "تم إلغاء كل العمليات"});
                  });
        } else if (postback == "rephone") {
            botly.sendText({id: senderId, text: "حسنا. يرجى إدخال رقم آخر 📱"});
        } else if (postback.startsWith("num-")) {
            let num = postback.split("num-");
            let shp = num[1].slice(-9);
              var reget = async function () {
                try {
                let proxies = await axios.get(process.env.ProxyAPI);
                let types = ["FR"];
                let filteredArr = proxies.data.filter(function (item) {
                  return types.includes(item.country);
                });
                let randomIndex = Math.floor(Math.random() * filteredArr.length);
                let randomObject = filteredArr[randomIndex];
                let proxy = "socks5://" + `${randomObject.ip}:${randomObject.port}`;
                let httpsAgent = new SocksProxyAgent(proxy, { timeout: 5000 });
                const timeNow = new Date().getTime();
                const user = await userDb(senderId);
                if (user[0].lastsms == null || user[0].lastsms < timeNow) {
                  const response = await axios({
                  method: "post",
                  url: "https://apim.djezzy.dz/oauth2/registration",
                  data: "scope=smsotp&client_id=6E6CwTkp8H1CyQxraPmcEJPQ7xka&msisdn=213" + shp,
                  headers: {
                      "content-type":"application/x-www-form-urlencoded",
                  },
                  httpsAgent: httpsAgent,
                });
                if (response.data.status == 200) {
                  const smsTimer = new Date().getTime() + 2 * 60 * 1000;
                  await updateUser(senderId, {step: "sms", num: shp, lastsms :smsTimer})
                  .then((data, error) => {
                    if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                    botly.sendText({id: senderId, text: "تم إرسال الرمز إلى الرقم 💬\nيرجى نسخ الرسالة 📋 أو كتابة الارقام التي وصلتك 🔢"});
                  });
                } else {
                  console.log(response.data)
                }
              } else {
                botly.sendText({id: senderId, text: "انتظر قليلا حتى يمكنك ارسال رمز جديد"});
              }
              } catch (error) {
                console.log("err code: ", error.code)
                console.log("err response: ", error.response.status)
                if (error.code) {
                  if (error.code == "ETIMEOUT") {
                    console.log("Proxy fail Retrying...")
                    reget();
                  } else {
                    console.log("other err code: ", error.code)
                  }
                } else if (error.response) {
                  if (error.response.status == 429) {
                    botly.sendText({id: senderId, text: "4⃣2️⃣9️⃣❗\nالكثير من الطلبات 😷 يرجى الانتظار قليلا..."});
                  } else {
                    console.log("other err response: ", error.response.data)
                  }
                }
              }
              };
              reget(); 
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
app.listen(3000, () => {
  console.log(`App is on port : 3000`);
  keepAppRunning();
});
