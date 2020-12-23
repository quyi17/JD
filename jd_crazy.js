/**
 * 疯狂的joy
 *
 * - 签到
 * - 挂机
 * - 购买、合并joy
 */

const $ = new Env('疯狂的joy');
let cookiesArr = [], isBox = false, notify;
let message = '', subTitle = '', option = {};
let jdNotify = false;//是否关闭通知，false打开通知推送，true关闭通知推送
const JD_API_HOST = 'https://api.m.jd.com';
let randomCount = $.isNode() ? 20 : 5;
const BUY_JOY_LEVEL = 1 // 默认购买的joy等级
const MERGE_WAIT = process.env.MERGE_WAIT ? process.env.MERGE_WAIT : 1000 * 60 // 默认1分钟一次购买合并
const PRODUCE_WAIT = process.env.PRODUCE_WAIT ? process.env.PRODUCE_WAIT : 1000 // 默认1秒一次模拟挂机

!(async () => {
  await requireConfig();
  if (!cookiesArr[0]) {
    $.msg($.name, '【提示】请先获取京东账号一cookie\n直接使用NobyDa的京东签到获取', 'https://bean.m.jd.com/', {"open-url": "https://bean.m.jd.com/"});
    return;
  }
  for (let i = 0; i < cookiesArr.length; i++) {
    if (cookiesArr[i]) {
      let cookie = cookiesArr[i];
      $.UserName = decodeURIComponent(cookie.match(/pt_pin=(.+?);/) && cookie.match(/pt_pin=(.+?);/)[1])
      $.index = i + 1;
      $.isLogin = true;
      $.nickName = '';
      await TotalBean(cookie);
      console.log(`\n开始【京东账号${$.index}】${$.nickName || $.UserName}\n`);
      if (!$.isLogin) {
        $.msg($.name, `【提示】cookie已失效`, `京东账号${$.index} ${$.nickName || $.UserName}\n请重新登录获取\nhttps://bean.m.jd.com/`, {"open-url": "https://bean.m.jd.com/"});

        if ($.isNode()) {
          await notify.sendNotify(`${$.name}cookie已失效 - ${$.UserName}`, `京东账号${$.index} ${$.UserName}\n请重新登录获取cookie`);
        } else {
          $.setdata('', `CookieJD${i ? i + 1 : ""}`);//cookie失效，故清空cookie。$.setdata('', `CookieJD${i ? i + 1 : "" }`);//cookie失效，故清空cookie。
        }
        continue
      }
      await new CrazyJoy(i, cookie, $.nickName).start()
    }
  }
})()
  .catch((e) => {
    $.log('', `❌ ${$.name}, 失败! 原因: ${e}!`, '')
  })
  .finally(() => {
    $.done();
  })

class CrazyJoy {
  _shop = []
  ctx = {}

  constructor(index, cookie, nickName) {
    this._index = index
    this._cookie = cookie
    this._nickName = nickName
  }

  async start() {
    await this.gameState()
    await this.doSign()
    setInterval(__ => this.produce(), PRODUCE_WAIT) // 模拟挂机1s一次
    setInterval(__ => this.checkAndMerge(), MERGE_WAIT) // 购买合并升级1分钟一次
    setInterval(__ => this.obtainAward(), 1000 * 60 * 30) //领取金币，固定30分钟一次
    // await this.produce()
    // await this.checkAndMerge()
  }

  async checkAndMerge() {
    // 购买
    await this.joyList()
    // 刷新商店
    await this.shop()
    console.log(`joy列表 ${this.ctx.joyIds}`)
    for (let i = 0; i < this.ctx.joyIds.length; i++) {
      let joy = this.ctx.joyIds[i]
      if (joy === 0) {
        await this.trade(BUY_JOY_LEVEL)
        await $.wait(1000)
      }
    }
    await this.joyList()
    // 开始合并
    let maybe = calc(this.ctx.joyIds)
    for (const it of Object.keys(maybe)) {
      let v = maybe[it]
      if (it > 0 && it < 34) {
        if (v.length > 1 && v.length > 2) {
          // 只合并一次，因为合并后joy索引会变化
          await this.moveOrMerge(v[0], v[1])
          await $.wait(1000 * 3)
        }
      }
    }
  }

  /**
   * 获取用户信息
   */
  gameState() {
    return new Promise((resolve) => {
      const body = {
        paramData: {
          inviter: 'DBwF_65db1jIoHqBDEMk8at9zd5YaBeE'
        }
      }
      $.get(this.taskUrl('crazyJoy_user_gameState', body), async (err, resp, data) => {
        try {
          if (err) {
            console.log(`${JSON.stringify(err)}`)
            console.log(`${$.name} API请求失败，请检查网路重试`)
          } else {
            data = JSON.parse(data);
            // console.log('ddd----ddd', data)
            if (data.success) {
              this.ctx = data.data
              console.log(`邀请码 ${this.ctx.userInviteCode}`)
              console.log(`当前joy币 ${this.ctx.totalCoinAmount}`)
              console.log(`离线收益 ${this.ctx.offlineCoinAmount}`)
              console.log(`最高级别的joy ${this.ctx.userTopLevelJoyId}级`)
            }
          }
        } catch (e) {
          $.logErr(e, resp);
        } finally {
          resolve(data);
        }
      })
    })
  }

// 获取joy列表
  joyList() {
    const body = {
      paramData: {
        inviter: 'DBwF_65db1jIoHqBDEMk8at9zd5YaBeE'
      }
    }
    return new Promise((resolve) => {
      $.get(this.taskUrl('crazyJoy_user_gameState', body), async (err, resp, data) => {
        try {
          if (err) {
            console.log(`${JSON.stringify(err)}`)
            console.log(`${$.name} API请求失败，请检查网路重试`)
          } else {
            data = JSON.parse(data);
            // console.log('ddd----ddd', data)
            if (data.success && data.data.joyIds) {
              this.ctx = data.data
            }
          }
        } catch (e) {
          $.logErr(e, resp);
        } finally {
          resolve(data);
        }
      })
    })
  }

// 领取金币
  obtainAward() {
    return new Promise((resolve) => {
      const body = {
        eventType: "HOUR_BENEFIT",
      }
      $.get(this.taskUrl('crazyJoy_event_obtainAward', body), async (err, resp, data) => {
        try {
          if (err) {
            console.log(`${JSON.stringify(err)}`)
            console.log(`${$.name} API请求失败，请检查网路重试`)
          } else {
            data = JSON.parse(data);
            if (data.success) {
              console.log(`领取金币奖励 --> ${data.data.coins}`)
            }
          }
        } catch (e) {
          $.logErr(e, resp);
        } finally {
          resolve(data);
        }
      })
    })
  }

// 签到
  doSign() {
    return new Promise((resolve) => {
      $.get(this.taskUrl('crazyJoy_task_doSign'), async (err, resp, data) => {
        try {
          if (err) {
            console.log(`${JSON.stringify(err)}`)
            console.log(`${$.name} API请求失败，请检查网路重试`)
          } else {
            data = JSON.parse(data);
            console.log(data.message)
          }
        } catch (e) {
          $.logErr(e, resp);
        } finally {
          resolve(data);
        }
      })
    })
  }

// 每日任务
  getTaskState() {
    const body = {"paramData": {"taskType": "DAY_TASK"}}
    return new Promise((resolve) => {
      $.get(this.taskUrl('crazyJoy_task_getTaskState', body), async (err, resp, data) => {
        try {
          if (err) {
            console.log(`${JSON.stringify(err)}`)
            console.log(`${$.name} API请求失败，请检查网路重试`)
          } else {
            data = JSON.parse(data);
            // console.log('ddd----ddd', data)
            if (data.success) {
              console.log(data.message)
            }
          }
        } catch (e) {
          $.logErr(e, resp);
        } finally {
          resolve(data);
        }
      })
    })
  }

// 模拟挂机获得金币
  produce() {
    return new Promise((resolve) => {
      $.get(this.taskUrl('crazyJoy_joy_produce'), async (err, resp, data) => {
        try {
          if (err) {
            console.log(`${JSON.stringify(err)}`)
            console.log(`${$.name} API请求失败，请检查网路重试`)
          } else {
            data = JSON.parse(data);
            if (data.success && data.data.coins) {
              console.log(`账号${this._index + 1} ${this._nickName} 模拟挂机中 获得${data.data.coins}个币，当前拥有${data.data.totalCoinAmount}`)
            }
          }
        } catch (e) {
          $.logErr(e, resp);
        } finally {
          resolve(data);
        }
      })
    })
  }

// 购买joy
  trade(joyLevel) {
    // 默认只能购买最高等级-1 级的joy
    const allowMaxLevel = this._shop[this._shop.length - 2]
    let cost = 0
    if (allowMaxLevel.joyId < joyLevel) {
      joyLevel = allowMaxLevel.joyId
      cost = allowMaxLevel.coins
    } else {
      for (let i = 0; i < this._shop; i++) {
        let it = this._shop[i]
        if (it.joyId == joyLevel) {
          cost = it.coins
          break
        }
      }
    }
    if (this.ctx.totalCoinAmount < cost) {
      console.log(`买不起等级为${joyLevel}的joy，需要${cost}，当前${this.ctx.totalCoinAmount}，跳过`)
      return
    }
    console.log(`购买${joyLevel} ${this._max_level} ${this._max_level < joyLevel}`)
    const body = {"action": "BUY", "joyId": joyLevel, "boxId": ""}
    return new Promise((resolve) => {
      $.get(this.taskUrl('crazyJoy_joy_trade', body), async (err, resp, data) => {
        try {
          if (err) {
            console.log(`${JSON.stringify(err)}`)
            console.log(`${$.name} API请求失败，请检查网路重试`)
          } else {
            data = JSON.parse(data);
            console.log(data)
            if (data.success) {
              console.log(`购买${joyLevel}级joy成功， 花费${data.data.coins}，下次购买费用 --> ${data.data.nextBuyPrice}， 剩余joy币 --> ${data.data.totalCoins}`)
              //更新当前剩余金币数量
              this.ctx.totalCoinAmount = data.data.totalCoins
            } else {
              console.log(data.message)
            }
          }
        } catch (e) {
          $.logErr(e, resp);
        } finally {
          resolve(data);
        }
      })
    })
  }

// 卖出
  trade1(joyId, boxId) {
    const body = {"action": "SELL", "joyId": joyId, "boxId": boxId}
    return new Promise((resolve) => {
      $.get(this.taskUrl('crazyJoy_joy_trade', body), async (err, resp, data) => {
        try {
          if (err) {
            console.log(`${JSON.stringify(err)}`)
            console.log(`${$.name} API请求失败，请检查网路重试`)
          } else {
            data = JSON.parse(data);
            if (data.success && data.data.coins) {
              console.log(`模拟挂机中 获得${data.data.coins}个币，当前拥有${data.data.totalCoinAmount}`)
            }
          }
        } catch (e) {
          $.logErr(e, resp);
        } finally {
          resolve(data);
        }
      })
    })
  }

  // 合并joy
  moveOrMerge(from, to) {
    // 等待5s再合并，不然会操作过于频繁
    const body = {
      "operateType": "MERGE",
      "fromBoxIndex": from,
      "targetBoxIndex": to
    }
    return new Promise((resolve) => {
      $.get(this.taskUrl('crazyJoy_joy_moveOrMerge', body), async (err, resp, data) => {
        try {
          if (err) {
            console.log(`${JSON.stringify(err)}`)
            console.log(`${$.name} API请求失败，请检查网路重试`)
          } else {
            data = JSON.parse(data);
            console.log(data)
            if (data.success) {
              console.log(`合并成功 下标${from} --> ${to} = ${data.data.newJoyId}`)
            }
          }
        } catch (e) {
          $.logErr(e, resp);
        } finally {
          resolve(data);
        }
      })
    })
  }

  // 查看商店
  shop() {
    const body = {"paramData": {"entry": "SHOP"}}
    return new Promise((resolve) => {
      $.get(this.taskUrl('crazyJoy_joy_allowBoughtList', body), async (err, resp, data) => {
        try {
          if (err) {
            console.log(`${JSON.stringify(err)}`)
            console.log(`${$.name} API请求失败，请检查网路重试`)
          } else {
            data = JSON.parse(data);
            if (data.success) {
              this._shop = data.data.shop
            }
          }
        } catch (e) {
          $.logErr(e, resp);
        } finally {
          resolve(data);
        }
      })
    })
  }

  taskUrl(functionId, body = '{}') {
    return {
      url: `${JD_API_HOST}/?body=${encodeURIComponent(JSON.stringify(body))}&appid=crazy_joy&functionId=${functionId}&t=${Date.now()}&uts=b8bf8319bc0e120e166849cb7e957d335fe01979`,
      headers: {
        'Cookie': this._cookie,
        'Accept': '*/*',
        'Connection': 'keep-alive',
        'User-Agent': 'jdpingou;iPhone;3.15.2;14.2;ae75259f6ca8378672006fc41079cd8c90c53be8;network/wifi;model/iPhone10,2;appBuild/100365;ADID/00000000-0000-0000-0000-000000000000;supportApplePay/1;hasUPPay/0;pushNoticeIsOpen/0;hasOCPay/0;supportBestPay/0;session/158;pap/JA2015_311210;brand/apple;supportJDSHWK/1;Mozilla/5.0 (iPhone; CPU iPhone OS 14_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
        'Accept-Language': 'zh-cn',
        'Referer': 'https://crazy-joy.jd.com/',
        'Accept-Encoding': 'gzip, deflate, br',
      }
    }
  }

}

function TotalBean(cookie) {
  return new Promise(async resolve => {
    const options = {
      "url": `https://wq.jd.com/user/info/QueryJDUserInfo?sceneval=2`,
      "headers": {
        "Accept": "application/json,text/plain, */*",
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "zh-cn",
        "Connection": "keep-alive",
        "Cookie": cookie,
        "Referer": "https://wqs.jd.com/my/jingdou/my.shtml?sceneval=2",
        "User-Agent": $.isNode() ? (process.env.JD_USER_AGENT ? process.env.JD_USER_AGENT : "jdapp;iPhone;9.2.2;14.2;%E4%BA%AC%E4%B8%9C/9.2.2 CFNetwork/1206 Darwin/20.1.0") : ($.getdata('JDUA') ? $.getdata('JDUA') : "jdapp;iPhone;9.2.2;14.2;%E4%BA%AC%E4%B8%9C/9.2.2 CFNetwork/1206 Darwin/20.1.0")
      }
    }
    $.post(options, (err, resp, data) => {
      try {
        if (err) {
          console.log(`${JSON.stringify(err)}`)
          console.log(`${$.name} API请求失败，请检查网路重试`)
        } else {
          if (data) {
            data = JSON.parse(data);
            if (data['retcode'] === 13) {
              $.isLogin = false; //cookie过期
              return
            }
            $.nickName = data['base'].nickname;
          } else {
            console.log(`京东服务器返回空数据`)
          }
        }
      } catch (e) {
        $.logErr(e, resp)
      } finally {
        resolve();
      }
    })
  })
}

function requireConfig() {
  return new Promise(resolve => {
    console.log('开始获取配置文件\n')
    notify = $.isNode() ? require('./sendNotify') : '';
    //Node.js用户请在jdCookie.js处填写京东ck;
    const jdCookieNode = $.isNode() ? require('./jdCookie.js') : '';
    if ($.isNode()) {
      Object.keys(jdCookieNode).forEach((item) => {
        if (jdCookieNode[item]) {
          cookiesArr.push(jdCookieNode[item])
        }
      })
      if (process.env.JD_DEBUG && process.env.JD_DEBUG === 'false') console.log = () => {
      };
    } else {
      cookiesArr.push(...[$.getdata('CookieJD'), $.getdata('CookieJD2')]);
    }
    console.log(`共${cookiesArr.length}个京东账号\n`)
    resolve()
  })
}

function calc(arr) {
  let obj = {};
  for (let i = 0; i < arr.length; i++) {
    let it = arr[i]
    if (Object.keys(obj).includes(`${it}`)) {
      obj[it].push(i)
    } else {
      obj[it] = [i]
    }
  }
  return obj;
}

// prettier-ignore
function Env(t, e) {
  class s {
    constructor(t) {
      this.env = t
    }

    send(t, e = "GET") {
      t = "string" == typeof t ? {url: t} : t;
      let s = this.get;
      return "POST" === e && (s = this.post), new Promise((e, i) => {
        s.call(this, t, (t, s, o) => {
          t ? i(t) : e(s)
        })
      })
    }

    get(t) {
      return this.send.call(this.env, t)
    }

    post(t) {
      return this.send.call(this.env, t, "POST")
    }
  }

  return new class {
    constructor(t, e) {
      this.name = t, this.http = new s(this), this.data = null, this.dataFile = "box.dat", this.logs = [], this.isMute = !1, this.logSeparator = "\n", this.startTime = (new Date).getTime(), Object.assign(this, e), this.log("", `\ud83d\udd14${this.name}, \u5f00\u59cb!`)
    }

    isNode() {
      return "undefined" != typeof module && !!module.exports
    }

    isQuanX() {
      return "undefined" != typeof $task
    }

    isSurge() {
      return "undefined" != typeof $httpClient && "undefined" == typeof $loon
    }

    isLoon() {
      return "undefined" != typeof $loon
    }

    toObj(t, e = null) {
      try {
        return JSON.parse(t)
      } catch {
        return e
      }
    }

    toStr(t, e = null) {
      try {
        return JSON.stringify(t)
      } catch {
        return e
      }
    }

    getjson(t, e) {
      let s = e;
      const i = this.getdata(t);
      if (i) try {
        s = JSON.parse(this.getdata(t))
      } catch {
      }
      return s
    }

    setjson(t, e) {
      try {
        return this.setdata(JSON.stringify(t), e)
      } catch {
        return !1
      }
    }

    getScript(t) {
      return new Promise(e => {
        this.get({url: t}, (t, s, i) => e(i))
      })
    }

    runScript(t, e) {
      return new Promise(s => {
        let i = this.getdata("@chavy_boxjs_userCfgs.httpapi");
        i = i ? i.replace(/\n/g, "").trim() : i;
        let o = this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");
        o = o ? 1 * o : 20, o = e && e.timeout ? e.timeout : o;
        const [r, h] = i.split("@"), a = {
          url: `http://${h}/v1/scripting/evaluate`,
          body: {script_text: t, mock_type: "cron", timeout: o},
          headers: {"X-Key": r, Accept: "*/*"}
        };
        this.post(a, (t, e, i) => s(i))
      }).catch(t => this.logErr(t))
    }

    loaddata() {
      if (!this.isNode()) return {};
      {
        this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path");
        const t = this.path.resolve(this.dataFile),
          e = this.path.resolve(process.cwd(), this.dataFile),
          s = this.fs.existsSync(t), i = !s && this.fs.existsSync(e);
        if (!s && !i) return {};
        {
          const i = s ? t : e;
          try {
            return JSON.parse(this.fs.readFileSync(i))
          } catch (t) {
            return {}
          }
        }
      }
    }

    writedata() {
      if (this.isNode()) {
        this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path");
        const t = this.path.resolve(this.dataFile),
          e = this.path.resolve(process.cwd(), this.dataFile),
          s = this.fs.existsSync(t), i = !s && this.fs.existsSync(e),
          o = JSON.stringify(this.data);
        s ? this.fs.writeFileSync(t, o) : i ? this.fs.writeFileSync(e, o) : this.fs.writeFileSync(t, o)
      }
    }

    lodash_get(t, e, s) {
      const i = e.replace(/\[(\d+)\]/g, ".$1").split(".");
      let o = t;
      for (const t of i) if (o = Object(o)[t], void 0 === o) return s;
      return o
    }

    lodash_set(t, e, s) {
      return Object(t) !== t ? t : (Array.isArray(e) || (e = e.toString().match(/[^.[\]]+/g) || []), e.slice(0, -1).reduce((t, s, i) => Object(t[s]) === t[s] ? t[s] : t[s] = Math.abs(e[i + 1]) >> 0 == +e[i + 1] ? [] : {}, t)[e[e.length - 1]] = s, t)
    }

    getdata(t) {
      let e = this.getval(t);
      if (/^@/.test(t)) {
        const [, s, i] = /^@(.*?)\.(.*?)$/.exec(t), o = s ? this.getval(s) : "";
        if (o) try {
          const t = JSON.parse(o);
          e = t ? this.lodash_get(t, i, "") : e
        } catch (t) {
          e = ""
        }
      }
      return e
    }

    setdata(t, e) {
      let s = !1;
      if (/^@/.test(e)) {
        const [, i, o] = /^@(.*?)\.(.*?)$/.exec(e), r = this.getval(i),
          h = i ? "null" === r ? null : r || "{}" : "{}";
        try {
          const e = JSON.parse(h);
          this.lodash_set(e, o, t), s = this.setval(JSON.stringify(e), i)
        } catch (e) {
          const r = {};
          this.lodash_set(r, o, t), s = this.setval(JSON.stringify(r), i)
        }
      } else s = this.setval(t, e);
      return s
    }

    getval(t) {
      return this.isSurge() || this.isLoon() ? $persistentStore.read(t) : this.isQuanX() ? $prefs.valueForKey(t) : this.isNode() ? (this.data = this.loaddata(), this.data[t]) : this.data && this.data[t] || null
    }

    setval(t, e) {
      return this.isSurge() || this.isLoon() ? $persistentStore.write(t, e) : this.isQuanX() ? $prefs.setValueForKey(t, e) : this.isNode() ? (this.data = this.loaddata(), this.data[e] = t, this.writedata(), !0) : this.data && this.data[e] || null
    }

    initGotEnv(t) {
      this.got = this.got ? this.got : require("got"), this.cktough = this.cktough ? this.cktough : require("tough-cookie"), this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar, t && (t.headers = t.headers ? t.headers : {}, void 0 === t.headers.Cookie && void 0 === t.cookieJar && (t.cookieJar = this.ckjar))
    }

    get(t, e = (() => {
    })) {
      t.headers && (delete t.headers["Content-Type"], delete t.headers["Content-Length"]), this.isSurge() || this.isLoon() ? $httpClient.get(t, (t, s, i) => {
        !t && s && (s.body = i, s.statusCode = s.status), e(t, s, i)
      }) : this.isQuanX() ? $task.fetch(t).then(t => {
        const {statusCode: s, statusCode: i, headers: o, body: r} = t;
        e(null, {status: s, statusCode: i, headers: o, body: r}, r)
      }, t => e(t)) : this.isNode() && (this.initGotEnv(t), this.got(t).on("redirect", (t, e) => {
        try {
          const s = t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();
          this.ckjar.setCookieSync(s, null), e.cookieJar = this.ckjar
        } catch (t) {
          this.logErr(t)
        }
      }).then(t => {
        const {statusCode: s, statusCode: i, headers: o, body: r} = t;
        e(null, {status: s, statusCode: i, headers: o, body: r}, r)
      }, t => e(t)))
    }

    post(t, e = (() => {
    })) {
      if (t.body && t.headers && !t.headers["Content-Type"] && (t.headers["Content-Type"] = "application/x-www-form-urlencoded"), t.headers && delete t.headers["Content-Length"], this.isSurge() || this.isLoon()) $httpClient.post(t, (t, s, i) => {
        !t && s && (s.body = i, s.statusCode = s.status), e(t, s, i)
      }); else if (this.isQuanX()) t.method = "POST", $task.fetch(t).then(t => {
        const {statusCode: s, statusCode: i, headers: o, body: r} = t;
        e(null, {status: s, statusCode: i, headers: o, body: r}, r)
      }, t => e(t)); else if (this.isNode()) {
        this.initGotEnv(t);
        const {url: s, ...i} = t;
        this.got.post(s, i).then(t => {
          const {statusCode: s, statusCode: i, headers: o, body: r} = t;
          e(null, {status: s, statusCode: i, headers: o, body: r}, r)
        }, t => e(t))
      }
    }

    time(t) {
      let e = {
        "M+": (new Date).getMonth() + 1,
        "d+": (new Date).getDate(),
        "H+": (new Date).getHours(),
        "m+": (new Date).getMinutes(),
        "s+": (new Date).getSeconds(),
        "q+": Math.floor(((new Date).getMonth() + 3) / 3),
        S: (new Date).getMilliseconds()
      };
      /(y+)/.test(t) && (t = t.replace(RegExp.$1, ((new Date).getFullYear() + "").substr(4 - RegExp.$1.length)));
      for (let s in e) new RegExp("(" + s + ")").test(t) && (t = t.replace(RegExp.$1, 1 == RegExp.$1.length ? e[s] : ("00" + e[s]).substr(("" + e[s]).length)));
      return t
    }

    msg(e = t, s = "", i = "", o) {
      const r = t => {
        if (!t || !this.isLoon() && this.isSurge()) return t;
        if ("string" == typeof t) return this.isLoon() ? t : this.isQuanX() ? {"open-url": t} : void 0;
        if ("object" == typeof t) {
          if (this.isLoon()) {
            let e = t.openUrl || t["open-url"],
              s = t.mediaUrl || t["media-url"];
            return {openUrl: e, mediaUrl: s}
          }
          if (this.isQuanX()) {
            let e = t["open-url"] || t.openUrl,
              s = t["media-url"] || t.mediaUrl;
            return {"open-url": e, "media-url": s}
          }
        }
      };
      this.isMute || (this.isSurge() || this.isLoon() ? $notification.post(e, s, i, r(o)) : this.isQuanX() && $notify(e, s, i, r(o)));
      let h = ["", "==============\ud83d\udce3\u7cfb\u7edf\u901a\u77e5\ud83d\udce3=============="];
      h.push(e), s && h.push(s), i && h.push(i), console.log(h.join("\n")), this.logs = this.logs.concat(h)
    }

    log(...t) {
      t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(t.join(this.logSeparator))
    }

    logErr(t, e) {
      const s = !this.isSurge() && !this.isQuanX() && !this.isLoon();
      s ? this.log("", `\u2757\ufe0f${this.name}, \u9519\u8bef!`, t.stack) : this.log("", `\u2757\ufe0f${this.name}, \u9519\u8bef!`, t)
    }

    wait(t) {
      return new Promise(e => setTimeout(e, t))
    }

    done(t = {}) {
      const e = (new Date).getTime(), s = (e - this.startTime) / 1e3;
      this.log("", `\ud83d\udd14${this.name}, \u7ed3\u675f! \ud83d\udd5b ${s} \u79d2`), this.log(), (this.isSurge() || this.isQuanX() || this.isLoon()) && $done(t)
    }
  }(t, e)
}
