var _learnq = _learnq || []
// if email doesnt exist, override _learnq.push to use local storage
var klaviyoCookie = document.cookie.split("; ").filter(function (c) {
  return /__kla_id=/.test(c)
})
var klQueuedRequestLimit = 100

function localStorageAvailable() {
  var test = "test"
  try {
    localStorage.setItem(test, test)
    localStorage.removeItem(test)
    return true
  } catch (e) {
    return false
  }
}

if (Array.isArray(klaviyoCookie) && klaviyoCookie.length && localStorageAvailable()) {
  klaviyoCookieData = JSON.parse(atob(klaviyoCookie[0].split("__kla_id=")[1]))

  function klPushFromLocal() {
    // run through all local identify & track requests and send to klaviyo
    var localLearnq = JSON.parse(localStorage.getItem("localLearnq")) || []
    var klEmail = _learnq.identify().$email
    var klRequest = []
    var klResponse = ""

    while (localLearnq.length > 0) {
      klRequest = localLearnq.pop()
      //klRequest[1] = JSON.parse(klRequest[1])
      if (klRequest[0] === "identify") {
        klRequest[1]["properties"]["$email"] = klEmail
      }
      if (klRequest[0] === "track") {
        klRequest[1]["customer_properties"] = { $email: klEmail }
      }
      klMakeRequest(klRequest[0], klRequest[1])
    }
  }

  if (!klaviyoCookieData["$email"]) {
    // If the cookie doesn't contain an email address, override the the push functionality for _learnq
    _learnq.old_push = _learnq.push
    _learnq.push = function (request) {
      if (request[0] === "identify") {
        // if someone attempts to identify the email address, unoverride push
        if (Object.keys(request[1]).includes("$email")) {
          _learnq.push = _learnq.old_push
          _learnq.push(["identify", { $email: request[1]["$email"] }])
          // then push everything in localstorage as a raw request
          klPushFromLocal()
          //  and wipe it from local storage
          localStorage.removeItem("localLearnq")
        } else {
          klLocalIdentify(request[1])
        }
      } else if (request[0] === "track") {
        klLocalTrack(request[1], request[2])
      }
    }

    function klLocalIdentify(klPropertyPayload) {
      // process and store a local identify request
      var localLearnq = JSON.parse(localStorage.getItem("localLearnq")) || []
      var payload = {
        token: _learnq.account(),
        properties: klPropertyPayload,
      };

      if (localLearnq.length == klQueuedRequestLimit) {
        localLearnq.pop()
      }

      localLearnq.unshift(["identify", payload])

      try {
        localStorage.setItem("localLearnq", JSON.stringify(localLearnq))
      } catch (domException) {
        if (domException.name === "QuotaExceededError" || domException.name === "NS_ERROR_DOM_QUOTA_REACHED") {
          // Remove the oldest event and try again
          localLearnq.pop()
          localStorage.setItem("localLearnq", JSON.stringify(localLearnq))
        }
      }
    }

    function klLocalTrack(kl_event_name, kl_event_payload) {
      // process and store a local track request
      var localLearnq = JSON.parse(localStorage.getItem("localLearnq")) || []
      var payload = {
        token: _learnq.account(),
        event: kl_event_name,
        properties: kl_event_payload,
        time: Math.round(Date.now() / 1000),
      }

      if (localLearnq.length == klQueuedRequestLimit) {
        localLearnq.pop()
      }

      localLearnq.unshift(["track", payload])
      try {
        localStorage.setItem("localLearnq", JSON.stringify(localLearnq))
      } catch (domException) {
        if (domException.name === "QuotaExceededError" || domException.name === "NS_ERROR_DOM_QUOTA_REACHED") {
          // Remove the oldest event and try again
          localLearnq.pop()
          localStorage.setItem("localLearnq", JSON.stringify(localLearnq))
        }
      }
    }

    function klMakeRequest(kl_method, kl_payload) {
      // build track or identify request
      var data = encodeURI(btoa(JSON.stringify(kl_payload)))
      var xhr = new XMLHttpRequest()
      var url = `https://a.klaviyo.com/api/${kl_method}?data=${data}`

      return new Promise(function (resolve, reject) {
        // log response when request completes
        xhr.onreadystatechange = function () {
          if (xhr.readyState == 4 && xhr.status == 200) {
            console.log(xhr.responseText)
            resolve()
          }
        }
        // open the request
        xhr.open("GET", url, true)
        // send request
        xhr.send()
      })
    }

  } else {
    klPushFromLocal()
  }
}