const config = require('./config');
const client = require('twilio')(config.twilio.accountSid, config.twilio.authToken);
const AmbientWeatherApi = require('ambient-weather-api');
const api = new AmbientWeatherApi({
  apiKey: config.ambientWeather.apiKey,
  applicationKey: config.ambientWeather.appKey
})

let windowsOpen = true;
let sentCloseWindows = false;
let sentOpenWindows = false;
let runCount = 0;

const getDeviceData = async () => {
  let results;
  let devices = api.userDevices();
  console.log('Calling Weather API...');

  try {
    results = await devices;
    return results;
  } catch (e) {
    console.error(e);
    return false;
  } finally {
    // do something, or not...
  }
}

const notifyDevices = async (msg) => {
  client.messages
    .create({
      body: msg,
      from: config.notification.phoneFrom,
      to: config.notification.phoneTo
    })
    .then(message => console.log(message.sid))
    .then(function () {
      console.log('notify windowsOpen', windowsOpen);
      if (windowsOpen) {
        sentOpenWindows = true;
      } else {
        sentOpenWindows = false;
      }

      if (!windowsOpen) {
        sentCloseWindows = true;
      } else {
        sentCloseWindows = false;
      }

      console.log('sentCloseWindows', sentCloseWindows);
      console.log('sentOpenWindows', sentOpenWindows);
    });
}


const runloop = async () => {
  while (true) {
    // getDeviceData().then(res => {
    //   console.log('Calling SMS API...')
    //   notifyDevices(res[0].lastData.tempinf);
    // });
    let compare = await compareData();
    if (!compare) {
      await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
      continue;
    }
    console.log('runloop windowsOpen', windowsOpen);
    let message = windowsOpen ? 'Open the windows' : 'Close the windows';
    if (runCount == 0) {
      console.log('runloop count', runCount);
      await notifyDevices('toggle windows restarted');
      await notifyDevices(message);
    } else {
      let didSendNotification = await determineIfSent();
      if (!didSendNotification) {
        await notifyDevices(message);
      } else {
        console.log('Notification already sent');
      }
    }
    console.log('windowsShouldBeOpen', windowsOpen);
    console.log('---');
    runCount++;
    await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
  }
}

const determineIfSent = async () => {
  if (windowsOpen) {
    if (sentOpenWindows) {
      return true;
    } else {
      return false;
    }
  } else {
    if (sentCloseWindows) {
      return true;
    } else {
      return false;
    }
  }
}

const compareData = async () => {
  let data = await getDeviceData();
  if (!data) {
    return false;
  };
  data = data[0]['lastData'];
  console.log('out:' + data.tempf, "in:" + data.tempinf);

  //morning - windowsopen:true and outside lower than inside
  //should windowsopen:true

  //morning - windowsopen:true and outside higher than inside
  //should windowsopen:false

  if (windowsOpen && (data.tempf > data.tempinf)) {
    windowsOpen = false;
  }

  //evening - windowsopen:false and outside higher than inside
  //should windowsopen:false

  //evening - windowsopen:false and outside lower than inside
  //should windowsopen:true

  if (!windowsOpen && (data.tempf < data.tempinf)) {
    windowsOpen = true;
  }

  return true;
}

runloop();
