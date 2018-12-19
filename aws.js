
const deviceModule = require('aws-iot-device-sdk').device;
const cmdLineProcess = require('aws-iot-device-sdk/examples/lib/cmdline');

var ModbusRTU = require("modbus-serial/index");
var client = new ModbusRTU();
var networkErrors = ["ESOCKETTIMEDOUT", "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EHOSTUNREACH"];

var payload = {
  deviceId: "rpia",
  ssid: '',
  ipaddr: [],
  rtd: [],
  timeStampEpoch: Date.now(), 
  timeStampIso: new Date(),
  count: 0
};
   
//begin module

function readEpSolar() {
	// open connection to a serial port
	client.connectRTU("/dev/EPSOLAR", { baudRate: 115200 })
		.then(setClient)				// default serial port settings are 9600,8,n,1.
		.then(function() {				// serial communication parameters: 115200bps baudrate, 8 data bits, 1 stop bit and no parity,no handshaking
			//console.log("epSolar connected"); 
			})
		.catch(function(e) {
			if(e.errno) {
				if(networkErrors.includes(e.errno)) {
					console.log("we have to reconnect");
				}
			}
			console.log(e.message); });

	function setClient() {
		// set the client's unit id
		// set a timout for requests default is null (no timeout)
		client.setID(1);
		client.setTimeout(1000);

		// run program
		readRealTimeData1();
	}

	function readRealTimeData1() {
		// read the 4 registers starting at address 5
		client.readInputRegisters(12544, 8)
			.then(function(d) {
				payload.rtd = d.data; 
				console.log("epSolar sent:", d.data); })
			.catch(function(e) {
				console.log(e.message); })
			.then(close);
	}

	function close() {
		//console.log("close");
		client.close();
	}

}

function processTest(args) {
   //
   // The device module exports an MQTT instance, which will attempt
   // to connect to the AWS IoT endpoint configured in the arguments.
   // Once connected, it will emit events which our application can
   // handle.
   //
   const device = deviceModule({
      keyPath: args.privateKey,
      certPath: args.clientCert,
      caPath: args.caCert,
      clientId: args.clientId,
      region: args.region,
      baseReconnectTimeMs: args.baseReconnectTimeMs,
      keepalive: args.keepAlive,
      protocol: args.Protocol,
      port: args.Port,
      host: args.Host,
      debug: args.Debug
   });
   
   const { exec } = require('child_process');

   function os_func() {
      this.execCommand = function(cmd, callback) {
         exec(cmd, (error, stdout, stderr) => {
            if (error) {
               console.error(`exec error: ${error}`);
               return;
            }
            callback(stdout.trim());
         });
      }
   }

   var timeout;
   const minimumDelay = 250;
   var os1 = new os_func();
   var os2 = new os_func();
   var os3 = new os_func();
   
   device.subscribe('command/rpia/#');

   if ((Math.max(args.delay, minimumDelay)) !== args.delay) {
      console.log('substituting ' + minimumDelay + 'ms delay for ' + args.delay + 'ms...');
   }
   
   timeout = setInterval(function() {
      payload.count++;
	  os1.execCommand('/sbin/iwgetid -r', function (returnvalue) {
		 payload.ssid = returnvalue.trim();
		 os2.execCommand('ifconfig | grep mask', function (returnvalue) {
	        var lines = returnvalue.split("\n");
	        for(i = 0; i < lines.length; i++) {
		       var words = lines[i].trim().split(" ");
		       payload.ipaddr[i] = words[1];
	        }
	        readEpSolar();
		    payload.timeStampEpoch = Date.now(), 
		    payload.timeStampIso = new Date(), 
		    setTimeout(function() {
			   console.log(new Date(), JSON.stringify(payload));
			   device.publish('device/rpia/devicePayload', JSON.stringify(payload)); 
		    }, 2000);
		 });
	  })

   }, Math.max(args.delay, minimumDelay)); // clip to minimum

   //
   // Do a simple publish/subscribe demo based on the test-mode passed
   // in the command line arguments.  If test-mode is 1, subscribe to
   // 'topic_1' and publish to 'topic_2'; otherwise vice versa.  Publish
   // a message every four seconds.
   //
   device
      .on('connect', function() {
         console.log(new Date(), 'connect');
      });
   device
      .on('close', function() {
         console.log(new Date(), 'close');
      });
   device
      .on('reconnect', function() {
         console.log(new Date(), 'reconnect');
      });
   device
      .on('offline', function() {
         console.log(new Date(), 'offline');
      });
   device
      .on('error', function(error) {
         console.log(new Date(), 'error', error);
      });
   device
      .on('message', function(topic, payload) {
         console.log(new Date(), 'message', topic, payload.toString());
      });

}

module.exports = cmdLineProcess;

if (require.main === module) {
   cmdLineProcess('connect to the AWS IoT service and publish/subscribe to topics using MQTT, test modes 1-2',
      process.argv.slice(2), processTest);
}
