const express = require("express");
const app = express();
const Botly = require("botly");
const axios = require("axios");
const os = require('os');
const https = require('https');
const { SocksProxyAgent } = require("socks-proxy-agent");
const { HttpsProxyAgent  } = require('https-proxy-agent');

const httpsAgent = new SocksProxyAgent(process.env.PROXY);
const botly = new Botly({
	accessToken: process.env.PAGE_ACCESS_TOKEN,
	notificationType: Botly.CONST.REGULAR,
	FB_URL: "https://graph.facebook.com/v2.6/",
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SB_URL, process.env.SB_KEY, { auth: { persistSession: false} });

const twoGb = {"data":{"id":"GIFTWALKWIN","type":"products","meta":{"services":{"steps":10000,"code":"GIFTWALKWIN2GO","id":"WALKWIN"}}}};
//const foreGb = {"data":{"id":"GIFTWALKWIN","type":"products","meta":{"services":{"steps":15000,"code":"GIFTWALKWIN4GO","id":"WALKWIN"}}}};
//const fiveGb = {"data":{"id":"GIFTWALKWIN","type":"products","meta":{"services":{"steps":33570816,"code":"GIFTWALKWIN6GOWEEK","id":"WALKWIN"}}}};

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


async function createQueue(user) {
  const { data, error } = await supabase
      .from('queue')
      .insert([ user ]);

    if (error) {
      throw new Error('Error creating user : ', error);
    } else {
      return data
    }
};

async function queueDb() {
  const { data, error } = await supabase
    .from('queue')
    .select('*')
    .lte('logtime', new Date().getTime())

  if (error) {
    console.error('Error checking user:', error);
  } else {
    return data
  }
};

async function squeueDb(num) {
  const { data, error } = await supabase
    .from('queue')
    .select('*')
    .eq('num', num);

  if (error) {
    console.error('Error checking user:', error);
  } else {
    return data
  }
};

async function deleteQueue(uid) {
  const { data, error } = await supabase
      .from('queue')
      .delete()
      .eq('logtime', uid)

    if (error) {
      throw new Error('Error creating user : ', error);
    } else {
      return data
    }
};

function hideText(str) {
  const visiblePart = str.substring(0, 2);
  const hiddenPart = 'x'.repeat(str.length - 4);
  const lastPart = str.substring(str.length - 2);
  return visiblePart + hiddenPart + lastPart;
}

function keepAppRunning() {
  setInterval(async () => {
    https.get(`${process.env.RENDER_EXTERNAL_URL}/ping`, async (resp) => {
      if (resp.statusCode === 200) {
        console.log('Ping successful');
        const queue = await queueDb();
        if (queue[0]) {
          queue.forEach(async (user) => {
            const reget = async () => {
              const ipAddresses = process.env.PROXARR.split(',');
              const randomIndex = Math.floor(Math.random() * ipAddresses.length);
              const randAgent = new HttpsProxyAgent(`http://${ipAddresses[randomIndex]}`, { timeout: 5000, rejectUnauthorized: false });
              const shapNum = "0" + user.num;
              const hiddenNum = hideText(shapNum);
              try {
                const activate2GB = await axios({
                  method: "post",
                  url: `https://apim.djezzy.dz/djezzy-api/api/v1/subscribers/213${user.num}/subscription-product?include=`,
                  data: twoGb,
                  headers: { 'Authorization': `Bearer ${user.token}` },
                  httpsAgent: randAgent,
                });
                await deleteQueue(user.logtime)
                .then((data, error) => {
                  if (activate2GB.status == 200) {
                    botly.sendButtons({
                      id: user.uid,
                      text: `المستعمل برقم ${hiddenNum}😀\nتم تفعيل 2 جيغا بنجاح ✅🥳\nلا تنسى متابعة المطور 👇🏻 لدعم الصفحة 💜`,
                      buttons: [
                        botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                      ]});
                  } else {
                    console.log("other 200 : ", activate2GB.data)
                  }
                });
              } catch (error) {
                (async () => {
                  if (error.response) {
                    if (error.response.status == 429) {
                      await deleteQueue(user.logtime)
                      .then(async (data, error) => {
                        botly.sendText({id: user.uid, text: "4️⃣2️⃣9️⃣❗\nتمهل قليلا 😐 تم إجراء الكثير من الطلبات 📲 حاول بعد دقائق من فضلك."});
                      }); 
                    } else if (error.response.status == 401) {
                      await deleteQueue(user.logtime)
                      .then(async (data, error) => {
                        await updateUser(user.uid, {step: null, lastsms : null})
                      .then((data, error) => {
                        if (error) { botly.sendText({id: user.uid, text: "حدث خطأ"}); }
                        botly.sendText({id: user.uid, text: `المستعمل برقم ${hiddenNum}! 🤕\nيبدو أنك إستعملت الخدمة هذا الاسبوع يرجى إنتظار ايام حتى يمكنك إعادة تفعيل الخدمة ✅`});
                      });
                      });
                    } else if (error.response.status == 403) {
                      await deleteQueue(user.logtime)
                      .then(async (data, error) => {
                        console.log("ERR 403 in Queue")
                      });
                    } else if (error.response.status == 404) {
                      await deleteQueue(user.logtime)
                      .then(async (data, error) => {
                        botly.sendButtons({
                          id: senderId,
                          text: "حدث خطأ. رجاءا أعد المحاولة و إذا تابع هذا الخطأ في الظهور راسل المطور 👇🏻",
                          buttons: [
                            botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                          ]});
                      });
                    } else if (error.response.status == 444) {
                    } else {
                      await deleteQueue(user.logtime)
                      .then(async (data, error) => {
                        console.log("40x :", error.response.status)
                      });
                    }
                  } else {
                    console.log("Proxy fail Retrying...")
                    reget();
                  }
                })();
              }
            }
            reget();
          });
        } else {
          console.log("No Queue...")
        }
      } else {
        console.error('Ping failed');
      }
    });
  }, 2 * 60 * 1000);
};

function remainingTime(timestamp) {
  const currentTime = Math.floor(Date.now() / 1000);
  const remainingSeconds = Math.max(timestamp - currentTime, 0);

  if (remainingSeconds === 0) {
    return 'now';
  }

  const minutes = Math.floor(remainingSeconds / 60);
  const remaining = remainingSeconds % 60;

  if (remainingSeconds > 660) {
    return `${minutes} دقيقة`;
  } else if (remainingSeconds <= 660 && remainingSeconds > 60) {
    return `${minutes} دقائق`;
  } else {
    return `${Math.floor(remaining)} ثانية`;
  }
}

/* ----- HANDELS ----- */

const onMessage = async (senderId, message) => {
  const timeNow = new Date().getTime();
    if (message.message.text) {
      const user = await userDb(senderId);
      if (user[0]) {
        if (user[0].step == null) {
          var numbers = message.message.text.match(/\d+/g);
          if (numbers) {
            var numberString = numbers.join('');
            const queue = await squeueDb(numberString.slice(1));
            if (queue[0]) {
              var hiddenNum = hideText(numberString);
              const waitime = remainingTime(queue[0].logtime / 1000);
              if (waitime == 'now') {
                await updateUser(senderId, {step: null , lastsms: null})
                  .then(async (data, error) => {
                    if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                    const reget = async () => {
                      const ipAddresses = process.env.PROXARR.split(',');
                      const randomIndex = Math.floor(Math.random() * ipAddresses.length);
                      const randAgent = new HttpsProxyAgent(`http://${ipAddresses[randomIndex]}`, { timeout: 5000, rejectUnauthorized: false });
                      try {
                        const activate2GB = await axios({
                          method: "post",
                          url: `https://apim.djezzy.dz/djezzy-api/api/v1/subscribers/213${queue[0].num}/subscription-product?include=`,
                          data: twoGb,
                          headers: { 'Authorization': `Bearer ${queue[0].token}` },
                          httpsAgent: randAgent,
                        });
  
                        await deleteQueue(queue[0].logtime)
                        .then((data, error) => {
                          if (activate2GB.status == 200) {
                            botly.sendButtons({
                              id: senderId,
                              text: "تم تفعيل الـ2 جيغا بنجاح 🥳✅\nلا تنسى متابعة مطور الصفحة 😁👇🏻",
                              buttons: [
                                botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                              ]});
                            } else {
                              console.log("other 200 : ", activate2GB.data)
                            }
                          });
                        } catch (error) {
                          (async () => {
                            if (error.response) {
                              if (error.response.status == 429) {
                                botly.sendText({id: senderId, text: "4⃣2️⃣9️⃣❗\nالكثير من الطلبات 😷 يرجى الانتظار قليلا..."});
                              } else if (error.response.status == 401) {
                                await updateUser(senderId, {step: null, lastsms : null})
                                .then((data, error) => {
                                  if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                                  botly.sendText({id: senderId, text: "حدث خطأ! 🤕\nيبدو أنك إستعملت الخدمة هذا الاسبوع يرجى إنتظار ايام حتى يمكنك إعادة تفعيل الخدمة ✅"});
                                });
                              } else if (error.response.status == 403) {
                                await updateUser(senderId, {step: "cooldown", token: otp.data.access_token, lastact: new Date().getTime() + 30 * 60 * 1000, lastsms : null})
                                .then((data, error) => {
                                  if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                                    botly.sendButtons({
                                      id: senderId,
                                      text: "يرجى إنتظار 30 دقيقة و إعادة المحاولة",
                                      buttons: [
                                        botly.createPostbackButton("تفعيل تلقائي 🤖", "autoAct"),
                                        botly.createPostbackButton("إلغاء العملية ❎", "cancel")
                                      ]});
                                });
                              } else if (error.response.status == 404) {
                                botly.sendButtons({
                                  id: senderId,
                                  text: "حدث خطأ. رجاءا أعد المحاولة و إذا تابع هذا الخطأ في الظهور راسل المطور 👇🏻",
                                  buttons: [
                                    botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                                  ]});
                              } else if (error.response.status == 444) {
                              } else {
                                console.log("40x :", error.response.status)
                              }
                            } else {
                              console.log("Proxy fail Retrying...")
                              reget();
                            }
                          })();
                        }
                    };

                    reget();

                  });
              } else {
                botly.sendText({id: senderId, text: `المستعمل ${hiddenNum} 📱\nأنت في قائمة الانتظار 📋😴\nيرجى إنتظار ${waitime} وسوف تتلقى الرد 😀.`});
              }
            } else {
              if (numberString.length === 10 && !isNaN(numberString) && numberString.startsWith("07")) {
                try {
                  const timeNow = new Date().getTime();
                  const user = await userDb(senderId);
                  const ipAddresses = process.env.PROXARR.split(',');
                  const randomIndex = Math.floor(Math.random() * ipAddresses.length);
                  console.log(`http://${ipAddresses[randomIndex]}`)
                  const randAgent = new HttpsProxyAgent(`http://${ipAddresses[randomIndex]}`, { timeout: 5000, rejectUnauthorized: false });
                  if (user[0].lastsms == null || user[0].lastsms < timeNow) {
                    const response = await axios({
                      method: "post",
                      url: "https://apim.djezzy.dz/oauth2/registration",
                      data: "scope=smsotp&client_id=6E6CwTkp8H1CyQxraPmcEJPQ7xka&msisdn=213" + numberString.slice(1),
                      headers: { "content-type":"application/x-www-form-urlencoded" },
                      httpsAgent: randAgent,
                    });
                    if (response.data.status == 200) {
                      const smsTimer = new Date().getTime() + 2 * 60 * 1000;
                      await updateUser(senderId, {step: "sms", num: numberString.slice(1), lastsms :smsTimer})
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
              console.log(error)
                if (error.response.status == 429) {
                  botly.sendText({id: senderId, text: "4⃣2️⃣9️⃣❗\nالكثير من الطلبات 😷 يرجى الانتظار قليلا..."});
                } else if (error.response.status == 400) {
                  botly.sendText({id: senderId, text: "الرقم الذي أدخلته غير موجود"});
                } else if (error.response.status == 404) {
                  botly.sendButtons({
                    id: senderId,
                    text: "حدث خطأ. رجاءا أعد المحاولة و إذا تابع هذا الخطأ في الظهور راسل المطور 👇🏻",
                    buttons: [
                      botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                    ]});
                } else {
                  console.log("other err: ", error.response.status)
                }
            }
              } else {
                botly.sendText({id: senderId, text: "يرجى إدخال أرقام جيزي فقط !📱"});
              }
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
                const ipAddresses = process.env.PROXARR.split(',');
                const randomIndex = Math.floor(Math.random() * ipAddresses.length);
                const randAgent = new HttpsProxyAgent(`http://${ipAddresses[randomIndex]}`, { timeout: 5000, rejectUnauthorized: false });
                const otp = await axios({
                  method: "post",
                  url: "https://apim.djezzy.dz/oauth2/token",
                  data: `scope=openid&client_secret=MVpXHW_ImuMsxKIwrJpoVVMHjRsa&client_id=6E6CwTkp8H1CyQxraPmcEJPQ7xka&otp=${match[1]}&mobileNumber=213${user[0].num}&grant_type=mobile`,
                  headers: { "content-type":"application/x-www-form-urlencoded" },
                  httpsAgent: randAgent,
                });

                if (otp.data.access_token != undefined) {
                  await updateUser(senderId, {step: null , lastsms: null})
                  .then((data, error) => {
                    if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }

                    const reget = async () => {
                      const ipAddresses = process.env.PROXARR.split(',');
                      const randomIndex = Math.floor(Math.random() * ipAddresses.length);
                      const randAgent = new HttpsProxyAgent(`http://${ipAddresses[randomIndex]}`, { timeout: 5000, rejectUnauthorized: false });
                      try {
                        const activate2GB = await axios({
                          method: "post",
                          url: `https://apim.djezzy.dz/djezzy-api/api/v1/subscribers/213${user[0].num}/subscription-product?include=`,
                          data: twoGb,
                          headers: { 'Authorization': `Bearer ${otp.data.access_token}` },
                          httpsAgent: randAgent,
                        });

                        if (activate2GB.status == 200) {
                          botly.sendButtons({
                            id: senderId,
                            text: "تم تفعيل الـ2 جيغا بنجاح 🥳✅\nلا تنسى متابعة مطور الصفحة 😁👇🏻",
                            buttons: [
                              botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                            ]});
                          } else {
                            console.log("other 200 : ", activate2GB.data)
                          }

                        } catch (error) {
                          (async () => {
                            if (error.response) {
                              if (error.response.status == 429) {
                                botly.sendText({id: senderId, text: "4⃣2️⃣9️⃣❗\nالكثير من الطلبات 😷 يرجى الانتظار قليلا..."});
                              } else if (error.response.status == 401) {
                                await updateUser(senderId, {step: null, lastsms : null})
                                .then((data, error) => {
                                  if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                                  botly.sendText({id: senderId, text: "حدث خطأ! 🤕\nيبدو أنك إستعملت الخدمة هذا الاسبوع يرجى إنتظار ايام حتى يمكنك إعادة تفعيل الخدمة ✅"});
                                });
                              } else if (error.response.status == 403) {
                                await updateUser(senderId, {step: "cooldown", token: otp.data.access_token, lastact: new Date().getTime() + 30 * 60 * 1000, lastsms : null})
                                .then((data, error) => {
                                  if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                                    botly.sendButtons({
                                      id: senderId,
                                      text: "يرجى إنتظار 30 دقيقة و إعادة المحاولة",
                                      buttons: [
                                        botly.createPostbackButton("تفعيل تلقائي 🤖", "autoAct"),
                                        botly.createPostbackButton("إلغاء العملية ❎", "cancel")
                                      ]});
                                });
                              } else if (error.response.status == 404) {
                                botly.sendButtons({
                                  id: senderId,
                                  text: "حدث خطأ. رجاءا أعد المحاولة و إذا تابع هذا الخطأ في الظهور راسل المطور 👇🏻",
                                  buttons: [
                                    botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                                  ]});
                              } else if (error.response.status == 444) {
                              } else {
                                console.log("40x :", error.response.status)
                              }
                            } else {
                              console.log("Proxy fail Retrying...")
                              reget();
                            }
                          })();
                        }
                    };

                    reget();

                  });
                } else {
                  console.log("other otp: ", otp.data)
                }
              } catch (error) {
                if (error.response.status == 429) {
                  botly.sendText({id: senderId, text: "الكثير من الطلبات 😷 يرجى الانتظار قليلا ثم أدخل نفس الرمز...4⃣2️⃣9️⃣❗\n"});
                } else {
                  console.log("other err: ", error.response.status)
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
              const ipAddresses = process.env.PROXARR.split(',');
              const randomIndex = Math.floor(Math.random() * ipAddresses.length);
              const randAgent = new HttpsProxyAgent(`http://${ipAddresses[randomIndex]}`, { timeout: 5000, rejectUnauthorized: false });
              const otp = await axios({
                method: "post",
                url: "https://apim.djezzy.dz/oauth2/token",
                data: `scope=openid&client_secret=MVpXHW_ImuMsxKIwrJpoVVMHjRsa&client_id=6E6CwTkp8H1CyQxraPmcEJPQ7xka&otp=${message.message.text}&mobileNumber=213${user[0].num}&grant_type=mobile`,
                headers: { "content-type":"application/x-www-form-urlencoded" },
                httpsAgent: randAgent,
              });

              if (otp.data.access_token != undefined) {
                console.log("Token : ", otp.data.access_token)
                await updateUser(senderId, {step: null , lastsms: null})
                  .then((data, error) => {
                    if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }

                    const reget = async () => {
                      const ipAddresses = process.env.PROXARR.split(',');
                      const randomIndex = Math.floor(Math.random() * ipAddresses.length);
                      const randAgent = new HttpsProxyAgent(`http://${ipAddresses[randomIndex]}`, { timeout: 5000, rejectUnauthorized: false });
                      try {
                        const activate2GB = await axios({
                          method: "post",
                          url: `https://apim.djezzy.dz/djezzy-api/api/v1/subscribers/213${user[0].num}/subscription-product?include=`,
                          data: twoGb,
                          headers: { 'Authorization': `Bearer ${otp.data.access_token}` },
                          httpsAgent: randAgent,
                        });
                        //console.log("552 Log : ", activate2GB.data)
                        if (activate2GB.status == 200) {
                          botly.sendButtons({
                            id: senderId,
                            text: "تم تفعيل الـ2 جيغا بنجاح 🥳✅\nلا تنسى متابعة مطور الصفحة 😁👇🏻",
                            buttons: [
                              botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                            ]});
                          } else {
                            console.log("other 200 : ", activate2GB.data)
                          }

                        } catch (error) {
                          (async () => {
                            if (error.response) {
                              if (error.response.status == 429) {
                                botly.sendText({id: senderId, text: "4⃣2️⃣9️⃣❗\nالكثير من الطلبات 😷 يرجى الانتظار قليلا..."});
                              } else if (error.response.status == 401) {
                                await updateUser(senderId, {step: null, lastsms : null})
                                .then((data, error) => {
                                  if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                                  botly.sendText({id: senderId, text: "حدث خطأ! 🤕\nيبدو أنك إستعملت الخدمة هذا الاسبوع يرجى إنتظار ايام حتى يمكنك إعادة تفعيل الخدمة ✅"});
                                });
                              } else if (error.response.status == 403) {
                                await updateUser(senderId, {step: "cooldown", token: otp.data.access_token, lastact: new Date().getTime() + 30 * 60 * 1000, lastsms : null})
                                .then((data, error) => {
                                  if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                                    botly.sendButtons({
                                      id: senderId,
                                      text: "يرجى إنتظار 30 دقيقة و إعادة المحاولة",
                                      buttons: [
                                        botly.createPostbackButton("تفعيل تلقائي 🤖", "autoAct"),
                                        botly.createPostbackButton("إلغاء العملية ❎", "cancel")
                                      ]});
                                });
                              } else if (error.response.status == 404) {
                                botly.sendButtons({
                                  id: senderId,
                                  text: "حدث خطأ. رجاءا أعد المحاولة و إذا تابع هذا الخطأ في الظهور راسل المطور 👇🏻",
                                  buttons: [
                                    botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                                  ]});
                              } else if (error.response.status == 444) {
                              } else {
                                console.log("40x :", error.response.status)
                              }
                            } else {
                              console.log("Proxy fail Retrying...")
                              reget();
                            }
                          })();
                        }
                    };

                    reget();
                  
                  });
              } else {
                console.log("other otp: ", otp.data)
              }
            } catch (error) {
              if (error.response.status == 429) {
                botly.sendText({id: senderId, text: "الكثير من الطلبات 😷 يرجى الانتظار قليلا ثم أدخل نفس الرمز...4⃣2️⃣9️⃣❗\n"});
              } else {
                console.log("other err: ", error.response.status)
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
        } else if (user[0].step == "cooldown") {
          await updateUser(senderId, {step: null , lastsms: null})
                  .then((data, error) => {
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
                      });
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
            try {
              const timeNow = new Date().getTime();
              const user = await userDb(senderId);
              if (user[0].lastsms == null && user[0].num != null || user[0].lastsms < timeNow && user[0].num != null) {
                const response = await axios({
                  method: "post",
                  url: "https://apim.djezzy.dz/oauth2/registration",
                  data: "scope=smsotp&client_id=6E6CwTkp8H1CyQxraPmcEJPQ7xka&msisdn=213" + user[0].num,
                  headers: { "content-type":"application/x-www-form-urlencoded" },
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
                if (error.response.status == 429) {
                  botly.sendText({id: senderId, text: "4⃣2️⃣9️⃣❗\nالكثير من الطلبات 😷 يرجى الانتظار قليلا..."});
                } else if (error.response.status == 404) {
                  botly.sendButtons({
                    id: senderId,
                    text: "حدث خطأ. رجاءا أعد المحاولة و إذا تابع هذا الخطأ في الظهور راسل المطور 👇🏻",
                    buttons: [
                      botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                    ]});
                } else if (error.response.status == 400) {
                  botly.sendText({id: senderId, text: "الرقم الذي أدخلته غير موجود"});
                } else {
                  console.log("other err: ", error.response.status)
                }
            }
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
          botly.sendText({id: senderId, text: "تم تغيير نظام العمل 😴"});
        } else if (postback == "autoAct") {
          const user = await userDb(senderId);
          if (user[0].step == "cooldown") {
            await createQueue({uid: senderId, token: user[0].token, num: user[0].num, logtime: user[0].lastact})
                .then(async (data, error) => {
                  await updateUser(senderId, {step: null, lastsms : null})
                      .then((data, error) => {
                        if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                        botly.sendButtons({
                          id: senderId,
                          text: "تم إضافتك لقائمة الانتظار ✅\nسيتم محاولة تفعيل 2 جيغا بعد 30 دقيقة بشكل تلقائي 🤖",
                          buttons: [
                            botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                          ]});
                      });
                }); 
          } else {
            botly.sendText({id: senderId, text: "أنت لست في وضع الانتظار 😴"});
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
app.listen(3000, async () => {
  var myip = await axios.get("https://api.ipbase.com/v2/info?ip=");
  /*
    var info = {
      ip : myip.data.data.ip,
      org: myip.data.data.connection
    };
    console.log(info);
    */
    var proxip = await axios.get(`https://${process.env.THEAPI}type=get`);
    if (myip.data.data.ip == proxip.data.whitelisted[0]) {
      console.log(`IP Match ${myip.data.data.ip}✅${proxip.data.whitelisted[0]}`);
    } else {
      var replaceip = await axios.get(`https://${process.env.THEAPI}type=set&ip[]=${proxip.data.whitelisted[0]}&ip[]=${myip.data.data.ip}`);
      if (replaceip.data.status == 200) {
        console.log(`IP Replaced ${proxip.data.whitelisted[0]}🔄${myip.data.data.ip}`);
      }
    }
    console.log("App is on port : 3000 🥳");
    keepAppRunning();
});
