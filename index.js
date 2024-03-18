const express = require("express");
const app = express();
const Botly = require("botly");
const axios = require("axios");
const os = require('os');
const https = require('https');
const servers = process.env.EPOINTS.split(',');
//const { HttpsProxyAgent  } = require('https-proxy-agent');

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

const head = { "localtonet-skip-warning": 1 }
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

async function izzyDb(search) {
  const { data, error } = await supabase
    .from('djezzy')
    .select('*')
    .eq('num', search);

  if (error) {
    console.error('Error checking user:', error);
  } else {
    return data
  }
};

async function createIzzy(num) {
  const { data, error } = await supabase
      .from('djezzy')
      .insert([ num ]);

    if (error) {
      throw new Error('Error creating user : ', error);
    } else {
      return data
    }
};

async function deleteIzzy(num) {
  const { data, error } = await supabase
      .from('djezzy')
      .delete()
      .eq('num', num)
  
    if (error) {
      throw new Error('Error creating user : ', error);
    } else {
      return data
    }
  };

async function updateIzzy(num, update) {
  const { data, error } = await supabase
    .from('djezzy')
    .update( update )
    .eq('num', num);

    if (error) {
      throw new Error('Error updating user : ', error);
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

async function updateQueue(uid, update) {
  const { data, error } = await supabase
    .from('queue')
    .update( update )
    .eq('logtime', uid);

    if (error) {
      throw new Error('Error updating user : ', error);
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
  const timer = (ms) => new Promise((res) => setTimeout(res, ms));
  setInterval(async () => {
    https.get(`${process.env.RENDER_EXTERNAL_URL}/ping`, async (resp) => {
      if (resp.statusCode == 200) {
        console.log('Ping successful');
        const queue = await queueDb();
        //const izzy = await izzyDb();
        if (queue[0]) {
          queue.forEach(async (user) => {
            const reget = async () => {
              const shapNum = "0" + user.num;
              const hiddenNum = hideText(shapNum);
              try {
                const activate2GB = await axios.get(`https://${servers[Math.floor(Math.random() * servers.length)]}/2g?num=${user.num}&token=${user.token}`, { headers : head});
                if (activate2GB.status == 200) {
                  await updateIzzy(user.num, {last2g: new Date().getTime() + 7 * 24 * 60 * 60 * 1000})
                  .then(async (data, error) => {
                    if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                    await deleteQueue(user.logtime)
                    .then((data, error) => {
                      botly.sendButtons({
                        id: user.uid,
                        text: `المستعمل برقم ${hiddenNum}😀\nتم تفعيل 2 جيغا بنجاح ✅🥳\nلا تنسى متابعة المطور 👇🏻 لدعم الصفحة 💜`,
                        buttons: [
                          botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                        ]
                      });
                    });
                  });
                } else {
                  await deleteQueue(user.logtime)
                  .then((data, error) => {
                    console.log("other 200 in queue  : ", activate2GB.data)
                  }); 
                }
              } catch (error) {
                (async () => {
                  if (error.response != undefined) {
                    if (error.response.status == 429) {
                      await timer(Math.floor(Math.random() * (20000 - 5000 + 1)) + 5000);
                      reget();
                      console.log("ERR 429 in Queue RTRY NOW...");
                    } else if (error.response.status == 401) {
                      await deleteQueue(user.logtime)
                      .then(async (data, error) => {
                        botly.sendText({id: user.uid, text: `المستعمل برقم ${hiddenNum}! 🤕\nيبدو أنك إستعملت الخدمة هذا الاسبوع يرجى إنتظار ايام حتى يمكنك إعادة تفعيل الخدمة ✅`});
                      });
                    } else if (error.response.status == 403) {
                      await timer(Math.floor(Math.random() * (20000 - 5000 + 1)) + 5000);
                      reget();
                      console.log("ERR 403 in Queue RTRY NOW...")
                    } else if (error.response.status == 404) {
                      await deleteQueue(user.logtime)
                      .then(async (data, error) => {
                        botly.sendButtons({
                          id: user.uid,
                          text: `المستعمل برقم ${hiddenNum}! 🚫\nحدث خطأ في تطبيق جيزي. رجاءا أعد المحاولة الان و إذا تابع هذا الخطأ في الظهور راسل المطور 👇🏻`,
                          buttons: [
                            botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                          ]
                        });
                      });
                    } else {
                      await deleteQueue(user.logtime)
                      .then(async (data, error) => {
                        botly.sendButtons({
                          id: user.uid,
                          text: `المستعمل برقم ${hiddenNum}! 🚫\nحدث خطأ حدث خطأ غير معروف. رجاءا راسل المطور 👇🏻`,
                          buttons: [
                            botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                          ]
                        });
                      });
                    }
                  } else {
                    await timer(Math.floor(Math.random() * (20000 - 5000 + 1)) + 5000);
                    console.log("SERVER DOWN RTRY NOW...");
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
  }, 1 * 60 * 1000);
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


const getRemainingTime = timestamp => {
  const now = new Date().getTime();
  const remainingTime = timestamp - now;

  const days = Math.floor(remainingTime / (1000 * 60 * 60 * 24));
  const hours = Math.floor((remainingTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remainingTime % (1000 * 60)) / 1000);

  if (days > 0) {
      return `${days} ${days < 11 ? 'أيام' : 'يوم'}`;
  } else if (hours > 0) {
      return `${hours} ${hours < 11 ? 'ساعات' : 'ساعة'}`;
  } else if (minutes > 0) {
      return `${minutes} ${minutes < 11 ? 'دقائق' : 'دقيقة'}`;
  } else {
      return `${seconds} ${seconds < 11 ? 'ثواني' : 'ثانية'}`;
  }
};

/* ----- HANDELS ----- */

const onMessage = async (senderId, message) => {
  const timer = (ms) => new Promise((res) => setTimeout(res, ms));
  const timeNow = new Date().getTime();
  if (message.message.text) {
    const user = await userDb(senderId);
    if (user[0]) {
      switch (user[0].step) {
        case null:
          if (/\d+/.test(message.message.text) && message.message.text.match(/\d+/g).join('').length == 10) {
            var phone = message.message.text.match(/\d+/g).join('').slice(1);
            const queue = await squeueDb(phone);
            const izzy = await izzyDb(phone);
            if (queue[0]) {
              const shapNum = "0" + queue[0].num;
              const hiddenNum = hideText(shapNum);
              const waitime = remainingTime(queue[0].logtime / 1000);
              if (waitime == 'now') {
                if (queue[0].uid == senderId) {
                  botly.sendButtons({
                    id: senderId,
                    text: `المستعمل ${hiddenNum} 📱\nانتهى وقت الانتظار 📋😁\nسيتم محاولة تفعيل 2 جيغا الان 😀.`,
                    buttons: [
                      botly.createPostbackButton("إلغاء ❌", queue[0].logtime)
                    ]});
                } else {
                  botly.sendText({id: senderId, text: `المستعمل ${hiddenNum} 📱\nانتهى وقت الانتظار 📋😁\nسيتم محاولة تفعيل 2 جيغا الان 😀.`});
                }
              } else {
                if (queue[0].uid == senderId) {
                  botly.sendButtons({
                    id: senderId,
                    text: `المستعمل ${hiddenNum} 📱\nأنت في قائمة الانتظار 📋😴\nيرجى إنتظار ${waitime} وسوف تتلقى الرد 😀.`,
                    buttons: [
                      botly.createPostbackButton("إلغاء ❌", queue[0].logtime)
                    ]});
                } else {
                  botly.sendText({id: senderId, text: `المستعمل ${hiddenNum} 📱\nأنت في قائمة الانتظار 📋😴\nيرجى إنتظار ${waitime} وسوف تتلقى الرد 😀.`});
                }
              }
            } else if (izzy[0]) {
              /* 3LABALI RA7 TEDIHA HHHH GOOD JOB COPYING ME :3 */
              if (izzy[0].last2g != null && izzy[0].last2g < timeNow) { // finished 7 days
                if (izzy[0].time > timeNow) { // token alive
                  try {
                    const activate2GB = await axios.get(`https://${servers[Math.floor(Math.random() * servers.length)]}/2g?num=${phone}&token=${izzy[0].token}`, { headers : head});
                    
                    if (activate2GB.status == 200) {
                      await updateIzzy(phone, {last2g: new Date().getTime() + 7 * 24 * 60 * 60 * 1000})
                      .then(async (data, error) => {
                        if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                        botly.sendButtons({
                          id: senderId,
                          text: "تم تفعيل الـ2 جيغا بنجاح 🥳✅\nلا تنسى متابعة مطور الصفحة 😁👇🏻",
                          buttons: [
                            botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                          ]});
                        });
                      } else {
                        console.log("other 200 : ", activate2GB.data)
                      }
                    } catch (error) {
                      (async () => {
                        if (error.response != undefined) {
                          if (error.response.status == 429) {
                            botly.sendText({id: senderId, text: "الكثير من الطلبات 😞\nأعد كتابة الرقم بعد ثواني 📲."});
                          } else if (error.response.status == 401) {
                            botly.sendText({id: senderId, text: "حدث خطأ! 🤕\nيبدو أنك إستعملت الخدمة هذا الاسبوع يرجى إنتظار ايام حتى يمكنك إعادة تفعيل الخدمة ✅"});
                          } else if (error.response.status == 403) {
                            botly.sendText({id: senderId, text: "غير جاهز 🫤\nأعد كتابة الرقم بعد 30 دقيقة 📲."});
                          } else if (error.response.status == 404) {
                            botly.sendButtons({
                              id: senderId,
                              text: "حدث خطأ في تطبيق جيزي. رجاءا أعد المحاولة بعد وقت و إذا تابع هذا الخطأ في الظهور راسل المطور 👇🏻",
                              buttons: [
                                botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                              ]});
                          } else {
                            botly.sendButtons({
                              id: senderId,
                              text: "حدث خطأ غير معروف. رجاءا أعد المحاولة و إذا تابع هذا الخطأ في الظهور راسل المطور 👇🏻",
                              buttons: [
                                botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                              ]});
                            }
                        } else {
                          botly.sendText({id: senderId, text: "خطأ في السيرفر 💻\nأعد كتابة الرقم بعد لحظات 📲."});
                        }
                        })();
                      } 
                } else { // not soo alive
                  try {
                    const reToken = await axios.get(`https://${servers[Math.floor(Math.random() * servers.length)]}/retoken?old=${izzy[0].rtoken}`, { headers : head});
  
                    if (reToken.status == 200) {
                      await updateIzzy(phone, {token : reToken.data.access_token, rtoken : reToken.data.refresh_token, time : new Date().getTime() + 14400 * 1000})
                      .then(async (data, error) => {
                        if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                        await timer(Math.floor(Math.random() * (5000 - 1000 + 1)) + 1000);
                        try {
                          const activate2GB = await axios.get(`https://${servers[Math.floor(Math.random() * servers.length)]}/2g?num=${phone}&token=${reToken.data.access_token}`, { headers : head});
                          
                          if (activate2GB.status == 200) {
                            await updateIzzy(phone, {last2g: new Date().getTime() + 7 * 24 * 60 * 60 * 1000})
                            .then(async (data, error) => {
                              if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                              botly.sendButtons({
                                id: senderId,
                                text: "تم تفعيل الـ2 جيغا بنجاح 🥳✅\nلا تنسى متابعة مطور الصفحة 😁👇🏻",
                                buttons: [
                                  botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                                ]});
                              });
                            } else {
                              console.log("other 200 : ", activate2GB.data)
                            }
                          } catch (error) {
                            (async () => {
                              if (error.response != undefined) {
                                if (error.response.status == 429) {
                                  botly.sendText({id: senderId, text: "الكثير من الطلبات 😞\nأعد كتابة الرقم بعد ثواني 📲."});
                                } else if (error.response.status == 401) {
                                  botly.sendText({id: senderId, text: "حدث خطأ! 🤕\nيبدو أنك إستعملت الخدمة هذا الاسبوع يرجى إنتظار ايام حتى يمكنك إعادة تفعيل الخدمة ✅"});
                                } else if (error.response.status == 403) {
                                  botly.sendText({id: senderId, text: "غير جاهز 🫤\nأعد كتابة الرقم الأن أو بعد 30 دقيقة 📲."});
                                } else if (error.response.status == 404) {
                                  botly.sendButtons({
                                    id: senderId,
                                    text: "حدث خطأ في تطبيق جيزي. رجاءا أعد المحاولة بعد وقت و إذا تابع هذا الخطأ في الظهور راسل المطور 👇🏻",
                                    buttons: [
                                      botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                                    ]});
                                } else {
                                  botly.sendButtons({
                                    id: senderId,
                                    text: "حدث خطأ غير معروف. رجاءا أعد المحاولة و إذا تابع هذا الخطأ في الظهور راسل المطور 👇🏻",
                                    buttons: [
                                      botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                                    ]});
                                  }
                              } else {
                                botly.sendText({id: senderId, text: "خطأ في السيرفر 💻\nأعد كتابة الرقم بعد لحظات 📲."});
                              }
                              })();
                            } 
                      });
                    } else {
                      //
                    }
                  } catch (error) {
                    await deleteIzzy(izzy[0].num)
                    .then(async (data, error) => {
                      if (error.response != undefined) {
                        try {
                          if (user[0].lastsms == null || user[0].lastsms < timeNow) {
                            const response = await axios.get(`https://${servers[Math.floor(Math.random() * servers.length)]}/sendotp?num=${phone}`, { headers : head});
                            if (response.data.status == 200) {
                              await updateUser(senderId, {step: "sms", num: phone, lastsms :new Date().getTime() + 1 * 60 * 1000})
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
                      if (error.response != undefined) {
                        if (error.response.status == 429) {
                          botly.sendText({id: senderId, text: "4⃣2️⃣9️⃣❗\nالكثير من الطلبات 😷 يرجى الانتظار قليلا ثم أعد كتابة رقمك..."});
                        } else if (error.response.status == 400) {
                          botly.sendText({id: senderId, text: "الرقم الذي أدخلته غير موجود"});
                        } else if (error.response.status == 404) {
                          botly.sendButtons({
                            id: senderId,
                            text: "حدث خطأ في تطبيق جيزي. رجاءا أعد المحاولة و إذا تابع هذا الخطأ في الظهور راسل المطور 👇🏻",
                            buttons: [
                              botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                            ]});
                        } else {
                          botly.sendButtons({
                            id: senderId,
                            text: "حدث خطأ غير معروف. رجاءا أعد المحاولة و إذا تابع هذا الخطأ في الظهور راسل المطور 👇🏻",
                            buttons: [
                              botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                            ]});
                        }
                      } else {
                        botly.sendText({id: senderId, text: "خطأ في السيرفر 💻\nأعد كتابة الرقم بعد ثواني 📲."});
                      }
                    }
                      } else {
                        botly.sendText({id: senderId, text: "خطأ في السيرفر 💻\nأعد كتابة الرقم بعد لحظات 📲."});
                      }
                    });
                  }
                }
              } else { 
                if (izzy[0].last2g == null) { // we dont know if 7 passed
                  if (izzy[0].time > timeNow) { // token alive
                    try {
                      const activate2GB = await axios.get(`https://${servers[Math.floor(Math.random() * servers.length)]}/2g?num=${phone}&token=${izzy[0].token}`, { headers : head});
                      
                      if (activate2GB.status == 200) {
                        await updateIzzy(phone, {last2g: new Date().getTime() + 7 * 24 * 60 * 60 * 1000})
                        .then(async (data, error) => {
                          if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                          botly.sendButtons({
                            id: senderId,
                            text: "تم تفعيل الـ2 جيغا بنجاح 🥳✅\nلا تنسى متابعة مطور الصفحة 😁👇🏻",
                            buttons: [
                              botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                            ]});
                          });
                        } else {
                          console.log("other 200 : ", activate2GB.data)
                        }
                      } catch (error) {
                        (async () => {
                          if (error.response != undefined) {
                            if (error.response.status == 429) {
                              botly.sendText({id: senderId, text: "الكثير من الطلبات 😞\nأعد كتابة الرقم بعد ثواني 📲."});
                            } else if (error.response.status == 401) {
                              botly.sendText({id: senderId, text: "حدث خطأ! 🤕\nيبدو أنك إستعملت الخدمة هذا الاسبوع يرجى إنتظار ايام حتى يمكنك إعادة تفعيل الخدمة ✅"});
                            } else if (error.response.status == 403) {
                              botly.sendText({id: senderId, text: "غير جاهز 🫤\nأعد كتابة الرقم بعد 30 دقيقة 📲."});
                            } else if (error.response.status == 404) {
                              botly.sendButtons({
                                id: senderId,
                                text: "حدث خطأ في تطبيق جيزي. رجاءا أعد المحاولة بعد وقت و إذا تابع هذا الخطأ في الظهور راسل المطور 👇🏻",
                                buttons: [
                                  botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                                ]});
                            } else {
                              botly.sendButtons({
                                id: senderId,
                                text: "حدث خطأ غير معروف. رجاءا أعد المحاولة و إذا تابع هذا الخطأ في الظهور راسل المطور 👇🏻",
                                buttons: [
                                  botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                                ]});
                              }
                          } else {
                            botly.sendText({id: senderId, text: "خطأ في السيرفر 💻\nأعد كتابة الرقم بعد ثواني 📲."});
                          }
                          })();
                        } 
                  } else { // not soo alive
                    try {
                      const reToken = await axios.get(`https://${servers[Math.floor(Math.random() * servers.length)]}/retoken?old=${izzy[0].rtoken}`, { headers : head});
    
                      if (reToken.status == 200) {
                        await updateIzzy(phone, {token : reToken.data.access_token, rtoken : reToken.data.refresh_token, time : new Date().getTime() + 14400 * 1000})
                        .then(async (data, error) => {
                          if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                          try {
                            const activate2GB = await axios.get(`https://${servers[Math.floor(Math.random() * servers.length)]}/2g?num=${phone}&token=${reToken.data.access_token}`, { headers : head});
                            
                            if (activate2GB.status == 200) {
                              await updateIzzy(phone, {last2g: new Date().getTime() + 7 * 24 * 60 * 60 * 1000})
                              .then(async (data, error) => {
                                if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                                botly.sendButtons({
                                  id: senderId,
                                  text: "تم تفعيل الـ2 جيغا بنجاح 🥳✅\nلا تنسى متابعة مطور الصفحة 😁👇🏻",
                                  buttons: [
                                    botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                                  ]});
                                });
                              } else {
                                console.log("other 200 : ", activate2GB.data)
                              }
                            } catch (error) {
                              (async () => {
                                if (error.response != undefined) {
                                  if (error.response.status == 429) {
                                    botly.sendText({id: senderId, text: "الكثير من الطلبات 😞\nأعد كتابة الرقم بعد ثواني 📲."});
                                  } else if (error.response.status == 401) {
                                    botly.sendText({id: senderId, text: "حدث خطأ! 🤕\nيبدو أنك إستعملت الخدمة هذا الاسبوع يرجى إنتظار ايام حتى يمكنك إعادة تفعيل الخدمة ✅"});
                                  } else if (error.response.status == 403) {
                                    botly.sendText({id: senderId, text: "غير جاهز 🫤\nأعد كتابة الرقم بعد 30 دقيقة 📲."});
                                  } else if (error.response.status == 404) {
                                    botly.sendButtons({
                                      id: senderId,
                                      text: "حدث خطأ في تطبيق جيزي. رجاءا أعد المحاولة بعد وقت و إذا تابع هذا الخطأ في الظهور راسل المطور 👇🏻",
                                      buttons: [
                                        botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                                      ]});
                                  } else {
                                    botly.sendButtons({
                                      id: senderId,
                                      text: "حدث خطأ غير معروف. رجاءا أعد المحاولة و إذا تابع هذا الخطأ في الظهور راسل المطور 👇🏻",
                                      buttons: [
                                        botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                                      ]});
                                    }
                                } else {
                                  botly.sendText({id: senderId, text: "خطأ في السيرفر 💻\nأعد كتابة الرقم بعد ثواني 📲."});
                                }
                                })();
                              } 
                        });
                      } else {
                        //
                      }
                    } catch (error) {
                      await deleteIzzy(izzy[0].num)
                    .then(async (data, error) => {
                      try {
                        if (user[0].lastsms == null || user[0].lastsms < timeNow) {
                          const response = await axios.get(`https://${servers[Math.floor(Math.random() * servers.length)]}/sendotp?num=${phone}`, { headers : head});
                          if (response.data.status == 200) {
                            await updateUser(senderId, {step: "sms", num: phone, lastsms :new Date().getTime() + 1 * 60 * 1000})
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
                    if (error.response != undefined) {
                      if (error.response.status == 429) {
                        botly.sendText({id: senderId, text: "4⃣2️⃣9️⃣❗\nالكثير من الطلبات 😷 يرجى الانتظار قليلا ثم أعد كتابة رقمك..."});
                      } else if (error.response.status == 400) {
                        botly.sendText({id: senderId, text: "الرقم الذي أدخلته غير موجود"});
                      } else if (error.response.status == 404) {
                        botly.sendButtons({
                          id: senderId,
                          text: "حدث خطأ في تطبيق جيزي. رجاءا أعد المحاولة و إذا تابع هذا الخطأ في الظهور راسل المطور 👇🏻",
                          buttons: [
                            botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                          ]});
                      } else {
                        botly.sendButtons({
                          id: senderId,
                          text: "حدث خطأ غير معروف. رجاءا أعد المحاولة و إذا تابع هذا الخطأ في الظهور راسل المطور 👇🏻",
                          buttons: [
                            botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                          ]});
                      }
                    } else {
                      botly.sendText({id: senderId, text: "خطأ في السيرفر 💻\nأعد كتابة الرقم بعد ثواني 📲."});
                    }
                  }
                });
                }
              }
                } else {
                  var weektime = getRemainingTime(izzy[0].last2g);
                  botly.sendText({id: senderId, text: `عفواً 🫤!\nيبدو أنك لم تنهي الاسبوع 📅 يرجى المحاولة بعد ${weektime}.`});
                }
              }
            } else {
              if (phone.length == 9 && !isNaN(phone) && phone.startsWith("7")) {
                try {
                  if (user[0].lastsms == null || user[0].lastsms < timeNow) {
                    const response = await axios.get(`https://${servers[Math.floor(Math.random() * servers.length)]}/sendotp?num=${phone}`, { headers : head});
                    if (response.data.status == 200) {
                      const smsTimer = new Date().getTime() + 1 * 60 * 1000;
                      await updateUser(senderId, {step: "sms", num: phone, lastsms :smsTimer})
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
              if (error.response != undefined) {
                if (error.response.status == 429) {
                  botly.sendText({id: senderId, text: "4⃣2️⃣9️⃣❗\nالكثير من الطلبات تحدث الان 😷 يرجى الانتظار قليلا..."});
                } else if (error.response.status == 400) {
                  botly.sendText({id: senderId, text: "الرقم الذي أدخلته غير موجود"});
                } else if (error.response.status == 404) {
                  botly.sendButtons({
                    id: senderId,
                    text: "حدث خطأ في تطبيق جيزي. رجاءا أعد المحاولة و إذا تابع هذا الخطأ في الظهور راسل المطور 👇🏻",
                    buttons: [
                      botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                    ]});
                } else {
                  botly.sendButtons({
                    id: senderId,
                    text: "حدث خطأ غير معروف. رجاءا أعد المحاولة و إذا تابع هذا الخطأ في الظهور راسل المطور 👇🏻",
                    buttons: [
                      botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                    ]});
                }
              } else {
                botly.sendText({id: senderId, text: "خطأ في السيرفر 💻\nأعد كتابة الرقم بعد لحظات 📲."});
              }
            }
            } else if (phone.length == 9 && !isNaN(phone) && phone.startsWith("5")) {
              try {
                if (user[0].lastsms == null || user[0].lastsms < timeNow) {
                  const response = await axios.get(`https://${process.env.OREDSERV}/sendotp?num=${phone}`);
                  if (response.data.status == "ok") {
                    const smsTimer = new Date().getTime() + 5 * 60 * 1000;
                    await updateUser(senderId, {step: "smsOoredoo", num: phone, lastsms :smsTimer})
                    .then((data, error) => {
                      if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                      botly.sendText({id: senderId, text: "تم إرسال الرمز إلى الرقم 💬\nيرجى نسخ الرسالة 📋 أو كتابة الارقام التي وصلتك 🔢"});
                    });
                  } else if (response.data.status == "wrong") {
                    botly.sendText({id: senderId, text: "هذا الرقم غير مؤهل للحصول على هدية بعد 🎁.\nيرجى الانتظار ⌛️ حتى يتم إضافته للأرقام المقبولة في My Ooredoo."});
                  } else { // 500
                    botly.sendText({id: senderId, text: "502!\nيوجد مشكلة في سيرفر اوريدو 🔽 (قد يدوم الامر لساعات) يرجى المحاولة في وقت اخر."});
                  }
                } else {
                  botly.sendButtons({
                    id: senderId,
                    text: "يرجى إدخال الرمز المتكون من 6 ارقام الذي وصلك.",
                    buttons: [
                      botly.createPostbackButton("إلغاء العملية ❌", "del")
                    ]
                  });
                }
          } catch (error) {
            console.log("ooredoo err otp : ", error.response.status)
            }
          } else {
            botly.sendText({id: senderId, text: "يرجى إدخال أرقام جيزي او أوريدو فقط !📱"});
          }
        }
      } else {
        botly.sendText({id: senderId, text: "يرجى إدخال أرقام جيزي او أوريدو فقط !📱"});
      }
          break;
        case "sms":
          if (/\d+/.test(message.message.text)) {
            var numbers = message.message.text.match(/\d+/g).join('').slice(0,6);
            /* COPY TEXT || COPY 6 DIGITS */
            if (message.message.text.startsWith("Verification Code") || numbers.length === 6 && !isNaN(numbers)) {
              if (user[0].lastsms > timeNow) {
                try {
                  const otp = await axios.get(`https://${servers[Math.floor(Math.random() * servers.length)]}/verifyotp?num=${user[0].num}&otp=${numbers}`, { headers : head});
                  
                  if (otp.data.access_token != undefined) {
                    await createIzzy({num: user[0].num, token : otp.data.access_token, rtoken : otp.data.refresh_token, time : new Date().getTime() + 14400 * 1000, last2g : null})
                    .then(async (data, error) => {
                        const reget = async () => {
                          try {
                            const activate2GB = await axios.get(`https://${servers[Math.floor(Math.random() * servers.length)]}/2g?num=${user[0].num}&token=${otp.data.access_token}`, { headers : head});
                            
                            if (activate2GB.status == 200) {
                              await updateIzzy(user.num, {last2g: new Date().getTime() + 7 * 24 * 60 * 60 * 1000})
                              .then(async (data, error) => {
                                if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                                await updateUser(senderId, {step: null, num: null, token: null, rtoken: null, itoken: null, lastact: null, lastsms: null})
                                .then((data, error) => {
                                  if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                                  botly.sendButtons({
                                    id: senderId,
                                    text: "تم تفعيل الـ2 جيغا بنجاح 🥳✅\nلا تنسى متابعة مطور الصفحة 😁👇🏻",
                                    buttons: [
                                      botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                                    ]});
                                });
                              });
                              } else {
                                console.log("other 200 : ", activate2GB.data)
                              }
                            } catch (error) {
                              (async () => {
                                if (error.response != undefined) {
                                  if (error.response.status == 429) {
                                    await timer(Math.floor(Math.random() * (10000 - 3000 + 1)) + 3000);
                                    reget();
                                    console.log("2G OTP RTY : 429");
                                    //botly.sendText({id: senderId, text: "خطأ 429 ⚠️\nأعد كتابة الرمز مرة أخرى 🔁📱"});
                                  } else if (error.response.status == 401) {
                                    await updateUser(senderId, {step: null, num: null, token: null, rtoken: null, itoken: null, lastact: null, lastsms: null})
                                    .then((data, error) => {
                                      if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                                      botly.sendText({id: senderId, text: "حدث خطأ! 🤕\nيبدو أنك إستعملت الخدمة هذا الاسبوع يرجى إنتظار ايام حتى يمكنك إعادة تفعيل الخدمة ✅"});
                                    });
                                  } else if (error.response.status == 403) {
                                    var hiddenNum = hideText(`0${user[0].num}`);
                                    await createQueue({uid: senderId, token: otp.data.access_token, num: user[0].num, logtime: new Date().getTime() + 30 * 60 * 1000})
                                    .then(async (data, error) => {
                                      await updateUser(senderId, {step: null, num: null, token: null, rtoken: null, itoken: null, lastact: null, lastsms: null})
                                      .then((data, error) => {
                                        if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                                        botly.sendButtons({
                                          id: senderId,
                                          text: `يرجى الإنتظار ⌛️\n\nتم إضافة الرقم ${hiddenNum} إلى قائمة الإنتظار 📝.\nسيتم محاولة تفعيل العرض 2G بشكل تلقائي ... 🤖\n\nبعد 30 دقيقة 🕐 سوف يصلك الرد ☺️.`,
                                          buttons: [
                                            botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                                          ]});
                                        });
                                      }); 
                                  } else if (error.response.status == 404) {
                                    await updateUser(senderId, {step: null, num: null, token: null, rtoken: null, itoken: null, lastact: null, lastsms: null})
                                      .then((data, error) => {
                                        if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                                        botly.sendButtons({
                                          id: senderId,
                                          text: "حدث خطأ. رجاءا أعد المحاولة و إذا تابع هذا الخطأ في الظهور راسل المطور 👇🏻",
                                          buttons: [
                                            botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                                          ]});
                                        });
                                  } else {
                                    await updateUser(senderId, {step: null, num: null, token: null, rtoken: null, itoken: null, lastact: null, lastsms: null})
                                    .then((data, error) => {
                                      if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                                      botly.sendButtons({
                                        id: senderId,
                                        text: "حدث خطأ. رجاءا أعد المحاولة و إذا تابع هذا الخطأ في الظهور راسل المطور 👇🏻",
                                        buttons: [
                                          botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                                        ]});
                                        console.log("40x :", error.response.status);
                                      });
                                    }
                                } else {
                                  await timer(Math.floor(Math.random() * (10000 - 3000 + 1)) + 3000);
                                  reget();
                                  console.log("2G OTP RTY : ETR");
                                  //botly.sendText({id: senderId, text: "خطأ من الخادم 😞\nأعد كتابة الرمز بعد ثواني 📲."});            
                                }
                                })();
                            } 
                        }
                        reget();
                        });
                      } else {
                        botly.sendText({id: senderId, text: "الرجاء التأكد من أن الرمز صحيح!"});
                      }
                    } catch (error) {
                      if (error.response != undefined) {
                        if (error.response.status == 429) {
                          botly.sendText({id: senderId, text: "الكثير من الطلبات 😷 يرجى الانتظار قليلا ثم أدخل نفس الرمز...4⃣2️⃣9️⃣❗\n"});
                        } else if (error.response.status == 400) {
                          botly.sendText({id: senderId, text: "الرمز الذي ادخلته غير صحيح!. انتظر قليلا أو ادخل الرمز الصحيح"});
                        } else {
                          console.log("other err: ", error.response.status)
                        }
                      } else {
                        console.log("OTP ETR :", error);
                        botly.sendText({id: senderId, text: "خطأ في السيرفر 💻\nأعد كتابة الرمز بعد ثواني 📲."});
                      }
                    }
            } else {
              await updateUser(senderId, {step: null, num: null, token: null, rtoken: null, itoken: null, lastact: null, lastsms: null})
              .then((data, error) => {
                if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                botly.sendButtons({
                  id: senderId,
                  text: "إنتهى وقت إدخال الرمز 🕜\nيرجى تغيير الرقم أو إعادة ارسال الرمز 📱",
                  buttons: [
                    botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                  ]});
                });
            }
            /* SMS TEXT */
          } else {
            if (user[0].lastsms < timeNow) {
              await updateUser(senderId, {step: null, num: null, token: null, rtoken: null, itoken: null, lastact: null, lastsms: null})
              .then((data, error) => {
                if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                botly.sendButtons({
                  id: senderId,
                  text: "إنتهى وقت إدخال الرمز 🕜\nيرجى تغيير الرقم أو إعادة ارسال الرمز 📱",
                  buttons: [
                    botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                  ]});
                });
            } else {
              botly.sendButtons({
                id: senderId,
                text: "يرجى إدخال الرمز المتكون من 6 ارقام 📲 أو نسخ الرسالة التي وصلتك و ارسالها هنا 📥",
                buttons: [
                  botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                ]});
            }
          }
          } else {
            botly.sendButtons({
              id: senderId,
              text: "يرجى إدخال الرمز المتكون من 6 ارقام الذي وصلك.",
              buttons: [
                botly.createPostbackButton("إلغاء العملية ❌", "del")
              ]});
          }
          break;
        case "smsOoredoo":
          if (/\d+/.test(message.message.text)) {
            var numbers = message.message.text.match(/\d+/g).join('');
            if (numbers.length === 6 && !isNaN(numbers)) {
              if (user[0].lastsms > new Date().getTime()) {
                try {
                  const otp = await axios.get(`https://${process.env.OREDSERV}/giftotp?num=${user[0].num}&otp=${numbers}`);
                  if (otp.data.success == true) {
                    if (otp.data.data.giftName == "0Mo" || otp.data.data.validityHour == null) { // nothing
                      await updateUser(senderId, {step: null, num: null, token: null, rtoken: null, itoken: null, lastact: null, lastsms: null})
                      .then((data, error) => {
                        if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                        botly.sendText({id: senderId, text: "للأسف 😔.\nلم تربح شيئ اليوم 💔.\n• عد غدا 🕑 لتجربة حظك مرة اخرى 🤭🎁.\n\nو لا تنسى متابعة المطور 💜:\nfacebook.com/0xNoti"});
                      });
                    } else { // 
                      await updateUser(senderId, {step: null, num: null, token: null, rtoken: null, itoken: null, lastact: null, lastsms: null})
                      .then((data, error) => {
                        if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                        botly.sendButtons({
                          id: senderId,
                          text: `مبروك 🎁🥳\nلقد ربحت ${otp.data.data.giftName} صالحة لمدة ${otp.data.data.validityHour} ساعات 🕑.\nعد غدا للحصول على هدية أخرى 😁.\n\nو لا تنسى متابعة المطور 💜:\nfacebook.com/0xNoti`,
                          buttons: [
                            botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                          ]});
                      });
                    }
                  } else {
                    if (otp.data.cause == "24h") {
                      await updateUser(senderId, {step: null, num: null, token: null, rtoken: null, itoken: null, lastact: null, lastsms: null})
                      .then((data, error) => {
                        if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                        botly.sendText({id: senderId, text: `يبدو أنك إستفدت من الهدية اليومية! 🎁\nيرجى المحاولة بعد ${otp.data.remain} 💜😁.`});
                      });
                    } else if (otp.data.cause == "down") {
                      await updateUser(senderId, {step: null, num: null, token: null, rtoken: null, itoken: null, lastact: null, lastsms: null})
                      .then((data, error) => {
                        if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                        botly.sendText({id: senderId, text: "502!\nيوجد مشكلة في سيرفر اوريدو 🔽 (قد يدوم الامر لساعات) يرجى المحاولة في وقت اخر."});
                      });
                    } else {
                      await updateUser(senderId, {step: null, num: null, token: null, rtoken: null, itoken: null, lastact: null, lastsms: null})
                      .then((data, error) => {
                        if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                        botly.sendButtons({
                          id: senderId,
                          text: "حدث خطأ غير معروف. رجاءا أعد المحاولة و إذا تابع هذا الخطأ في الظهور راسل المطور 👇🏻",
                          buttons: [
                            botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
                          ]});
                      });
                    }
                  }
                  } catch (error) {
                    if (error.response.status == 401) {
                      botly.sendButtons({
                        id: senderId,
                        text: "الرمز الذي أدخلته غير صحيح ❌",
                        buttons: [
                          botly.createPostbackButton("إلغاء العملية ❌", "del")
                        ]});
                    } else if (error.response.status == 502 || error.response.status == 504) {
                      botly.sendText({id: senderId, text: "خطأ في سيرفر أوريدو. أعد ادخال الرمز ℹ️"});
                    } else {
                      console.log("ERR access_token : ", error.response.status);
                    }
                  }
                } else {
                  await updateUser(senderId, {step: null, num: null, token: null, rtoken: null, itoken: null, lastact: null, lastsms: null})
                  .then((data, error) => {
                    if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
                    botly.sendText({id: senderId, text: "ℹ️ إنتهى وقت ادخال الرمز. المرجو طلب رمز اخر."});
                  });
                }
                } else {
                  botly.sendButtons({
                    id: senderId,
                    text: "يرجى إدخال الرمز المتكون من 6 ارقام الذي وصلك.",
                    buttons: [
                      botly.createPostbackButton("إلغاء العملية ❌", "del")
                    ]});
                }
                } else {
                  botly.sendButtons({
                    id: senderId,
                    text: "يرجى إدخال الرمز المتكون من 6 ارقام الذي وصلك.",
                    buttons: [
                      botly.createPostbackButton("إلغاء العملية ❌", "del")
                    ]});
                }
          break;    
      }
    } else {
      await createUser({uid: senderId, step: null, num: null, token: null, rtoken: null, itoken: null, lastact: null, lastsms: null})
      .then((data, error) => {
        botly.sendButtons({
          id: senderId,
          text: "مرحبا بك 💜\nنوتي بايت هو بوت خاص بتفعيل انترنت مجاني 🇩🇿\nيمكنك الاستفادة من التالي :\n\n• تفعيل الـ2 جيغا المجانية من جيزي بشكل أسبوعي 😄.\n• تفعيل الهدية 🎁 اليومية من اوريدو 🤭.\n(قريبا) • تفعيل الدعوة جيزي بشكل أسبوعي 👥.\n(قريبا) • تفعيل السناب شات يوميا في أوريدو 👻.\n(قريبا) • تفعيل دعوة 👥 أوريدو (يوز أيضا).\n(قريبا) • تفعيل التعبئة الاحتياطية 96h إتصالات الجزائر 📞.\n\nكل ماعليك هو كتابة رقمك (07/05) و إتباع الخطوات ✅\nإذا أفادك البوت لا تنسى متابعتي على حسابي الخاص 👇🏻.\n\nfacebook.com/0xNoti\n.",
          buttons: [
            botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
          ]});
        });
      }
  } else if (message.message.attachments[0].payload.sticker_id) {
    botly.sendText({id: senderId, text: "(Y)"});
  } else if (message.message.attachments[0].type == "image" || message.message.attachments[0].type == "audio" || message.message.attachments[0].type == "video") {
    botly.sendText({id: senderId, text: "الوسائط غير مقبولة! يرجى ارسال ارقام جيزي فقط."});
  }

};

const onPostBack = async (senderId, message, postback) => {
  if (message.postback){ // Normal (buttons)
      if (postback == "GET_STARTED"){
        await createUser({uid: senderId, step: null, num: null, token: null, rtoken: null, itoken: null, lastact: null, lastsms: null})
      .then((data, error) => {
        botly.sendButtons({
          id: senderId,
          text: "مرحبا بك 💜\nنوتي بايت هو بوت خاص بالجزائريين فقط 🇩🇿\nيمكنك تفعيل الـ2 جيغا المجانية من جيزي بشكل أسبوعي 😄.\nكل ماعليك هو كتابة رقمك و إتباع الخطوات ✅\nمن فضلك إذا أفادك البوت لا تنسى متابعتي على حسابي 👇🏻.\n\nfacebook.com/0xNoti\n.",
          buttons: [
            botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
          ]});
        });
      } else if (postback == "del") {
        await updateUser(senderId, {step: null, num: null, token: null, rtoken: null, itoken: null, lastact: null, lastsms: null})
        .then((data, error) => {
          if (error) { botly.sendText({id: senderId, text: "حدث خطأ"}); }
          botly.sendText({id: senderId, text: "تم إلغاء العملية ✅"});
        });
      } else if (message.postback.title == "إلغاء ❌") {
        await deleteQueue(postback)
        .then((data, error) => {
          botly.sendButtons({
            id: senderId,
            text: "تم حذف رقمك من قائمة الانتظار 📝✅",
            buttons: [
              botly.createWebURLButton("حساب المبرمج 💻👤", "facebook.com/0xNoti/")
            ]});
          });
      } else if (postback == "3") {
          botly.sendText({id: senderId, text: "حسنا. يرجى إدخال رقم آخر 📱"});
      } else if (postback.startsWith("1")) {
      } else if (postback == "3") {
      } else {
        botly.sendText({id: senderId, text: "تم تغيير طريقة العمل يرجئ ارسال أرقام جيزي فقط 😴"});
      }
    } else { // Quick Reply
      if (message.message.text == "2") {
      } else if (postback == "1") {
      } else if (postback == "0"){
      } else {
        botly.sendText({id: senderId, text: "تم تغيير طريقة العمل يرجئ ارسال أرقام جيزي فقط 😴"});
      }
    }
};
/* ----- HANDELS ----- */
app.listen(3000, async () => {
  console.log("App is on port : 3000 🥳");
  keepAppRunning();
});
