
//
// npm driver for Renogy Rover 20/40 AMP MPPT Controller.
//
// 10/24/2017
//

/*
 * Copyright (C) 2017 Menlo Park Innovation LLC
 *
 * This is licensed software, all rights as to the software
 * is reserved by Menlo Park Innovation LLC.
 *
 * A license included with the distribution provides certain limited
 * rights to a given distribution of the work.
 *
 * This distribution includes a copy of the license agreement and must be
 * provided along with any further distribution or copy thereof.
 *
 * If this license is missing, or you wish to license under different
 * terms please contact:
 *
 * menloparkinnovation.com
 * menloparkinnovation@gmail.com
 */

//
// https://www.npmjs.com/package/modbus-serial
//
// sudo npm install --save modbus-serial
//
// sudo npm install --save serialport@4.0.7
//
// https://github.com/yaacov/node-modbus-serial/wiki
//

var ModbusRTU = require("modbus-serial");
 
function RenogyRover(config) {
    var self = this;

    self.config = config;

    // port is required.
    if ((typeof(config.trace) == "undefined") || (config.port == null)) {
        throw("serial port is required");
    }

    self.port = config.port;

    if (typeof(config.trace) != "undefined") {
        self.trace = config.trace;
    }
    else {
        self.trace = false;
    }

    if (typeof(config.traceError) != "undefined") {
        self.traceError = config.traceError;
    }
    else {
        self.traceError = false;
    }

    if (typeof(config.baudrate) != "undefined") {
        self.baudrate = config.baudrate;
    }
    else {
        self.baudrate = 9600;
    }

    if (typeof(config.modbusID) != "undefined") {
        self.modbusID = config.modbusID;
    }
    else {
        self.modbusID = 1;
    }

    if (typeof(config.modbusTimeout) != "undefined") {
        self.modbusTimeout = config.modbusTimeout;
    }
    else {
        self.modbusTimeout = 1000;
    }

    // client is the modbus client interface for low level modbus transactions.
    self.client = null;
}

//
// Return the modbus client object instance for custom commands.
//
RenogyRover.prototype.getModbusClient = function()
{
    return this.client;
}

RenogyRover.prototype.connect = function(callback)
{
    var self = this;

    // create an empty modbus client
    self.client = new ModbusRTU();

    self.client.setTimeout(self.modbusTimeout);
    self.client.setID(self.modbusID);

    //
    // open connection to a serial port
    //

    //
    // Renogy Rover appears to work with the buffered port option.
    // The unbuffered option returns various transfer data length
    // errors, since the modbus-serial expects whole packets, and
    // serial is an inherently async protocol.
    //
    // self.client.connectRTU(self.port, { baudrate: self.baudrate }, callback);
    //

    self.client.connectRTUBuffered(self.port, { baudrate: self.baudrate }, callback);
}

//
// Get product model string from device.
//
// Used to identify device, and that its in fact a Renogy MPPT
// 20 or 40 amp solar controller.
//
// callback(error, data)
//
RenogyRover.prototype.getProductModel = function(callback)
{
    var self = this;

    var registerBase;
    var registerLength;

    //
    // 0x000C (16) - Product Model.
    //

    registerBase = 0x000C;
    registerLength = 16;

    self.readHoldingRegisters(registerBase, registerLength, function(error, data) {

        if (error != null) {

            if (self.trace) {
                console.log("error reading product model error=" + error);
            }

            if (error.message != null) {
                if (self.trace) {
                    console.log("error reading product model error.message=" + error.message);
                }
            }

            callback(error, null);
            return;
        }

        //
        // Structure of returned data from json dump:
        //
        // data.data[] - array of data
        // data.buffer - node.js buffer type
        //

        //
        // data.buffer is a node.js Buffer type.
        //
        // https://nodejs.org/api/buffer.html
        // https://nodejs.org/api/buffer.html#buffer_buf_tostring_encoding_start_end
        //
        //console.log("data=");
        //dumpasjson(data);
        //

        var model = data.buffer.toString('ascii');

        if (self.trace) {
            console.log("model=" + model);
        }

        // Model shows as "     ML2420N"

        callback(null, model);
    });
}

//
// Get panel state.
//
// Connected
// voltage
// current
// MPPT point.
//
// Returns as object, which can readily be converted to JSON.
//
// 0x0107, 0x0108 - solar panel voltage * 0.1
// 0x
//
//

RenogyRover.prototype.getPanelState = function(callback)
{
    var self = this;

    var registerBase;
    var registerLength;

    var panelState = {};
    panelState.voltage = 0.0;
    panelState.current = 0.0;
    panelState.chargingPower = 0.0;

    //
    // 0x0107 (2) - Solar panel voltage  * 0.1
    // 0x0108 (2) - Solar panel current * 0.01
    // 0x0109 (2) - Charging Power actual value
    //

    registerBase = 0x0107;
    registerLength = 3;

    self.readHoldingRegisters(registerBase, registerLength, function(error, data) {

        if (error != null) {

            if (self.trace) {
                console.log("error reading panel voltage error=" + error);
            }

            if (error.message != null) {
                if (self.trace) {
                    console.log("error reading panel voltage error.message=" + error.message);
                }
            }

            callback(error, null);
            return;
        }

        // modbus registers are 16 bit
        panelState.voltage = data.buffer.readInt16BE(0);
        panelState.current = data.buffer.readInt16BE(2);
        panelState.chargingPower = data.buffer.readInt16BE(4);

        callback(null, panelState);
    });
}

//
// Get Battery State.
//
RenogyRover.prototype.getBatteryState = function(callback)
{
    var self = this;

    var registerBase;
    var registerLength;

    var batteryState = {};
    batteryState.stateOfCharge = 0;
    batteryState.voltage = 0.0;
    batteryState.chargingCurrent = 0.0;
    batteryState.controllerTemperature = 0.0;
    batteryState.batteryTemperature = 0.0;

    //
    // 0x0100 (2) - Battery capacity SOC (state of charge)
    // 0x0101 (2) - Battery voltage * 0.1
    // 0x0102 (2) - Charging current to battery * 0.01
    // 0x0103 (2) - Upper byte controller temperature bit 7 sign, bits 0 - 6 value
    //            - Lower byte battery temperature bit 7 sign, bits 0 - 6 value
    //

    registerBase = 0x0100;
    registerLength = 4;

    self.readHoldingRegisters(registerBase, registerLength, function(error, data) {

        if (error != null) {

            if (self.trace) {
                console.log("error reading battery state error=" + error);
            }

            if (error.message != null) {
                if (self.trace) {
                    console.log("error reading battery state error.message=" + error.message);
                }
            }

            callback(error, null);
            return;
        }

        // modbus registers are 16 bit
        batteryState.stateOfCharge = data.buffer.readInt16BE(0);
        batteryState.voltage = data.buffer.readInt16BE(2);
        batteryState.chargingCurrent = data.buffer.readInt16BE(4);
        batteryState.controllerTemperature = data.buffer.readInt8(6);
        batteryState.batteryTemperature = data.buffer.readInt8(7);

        callback(null, batteryState);
    });
}

//
// Get historical, or slowly changing parameters.
//
RenogyRover.prototype.getHistoricalParameters = function(callback)
{
    var self = this;

    var registerBase;
    var registerLength;

    var hist = {};
   
    hist.batteryVoltageMinForDay = 0.0;
    hist.batteryVoltageMaxForDay = 0.0;
    hist.maxChargeCurrentForDay = 0.0;
    hist.maxDischargeCurrentForDay = 0.0;
    hist.maxChargePowerForDay = 0.0;
    hist.maxDischargePowerForDay = 0.0;
    hist.maxChargeAmpHoursForDay = 0.0;
    hist.maxDischargeAmpHoursForDay = 0.0;
    hist.powerConsumptionForDay = 0.0;

    //
    // 0x010B (2) - Battery min voltage of current day * 0.1
    // 0x010C (2) - Battery max voltage of current day * 0.1
    // 0x010D (2) - max charging current of current day * 0.01
    // 0x010E (2) - max discharging current of current day * 0.01

    // 0x010F (2) - max charging power of the current day actual value
    // 0x0110 (2) - max discharging power of the current day actual value

    // 0x0111 (2) - charging amp hours of the current day actual value
    // 0x0112 (2) - discharging amp hours of the current day actual value
    // 0x0113 (2) - power generation of the current day actual value
    // 0x0114 (2) - power consumption of the current day actual value
    //

    registerBase = 0x010B;
    registerLength = 10;

    self.readHoldingRegisters(registerBase, registerLength, function(error, data) {

        if (error != null) {

            if (self.trace) {
                console.log("error reading historical data error=" + error);
            }

            if (error.message != null) {
                if (self.trace) {
                    console.log("error reading historical data error.message=" + error.message);
                }
            }

            callback(error, null);
            return;
        }

        //
        // modbus registers are 16 bit
        //
        hist.batteryVoltageMinForDay = data.buffer.readInt16BE(0);    // 0x010B
        hist.batteryVoltageMaxForDay = data.buffer.readInt16BE(2);    // 0x010C
        hist.maxChargeCurrentForDay = data.buffer.readInt16BE(4);     // 0x010D
        hist.maxDischargeCurrentForDay = data.buffer.readInt16BE(6);  // 0x010E
        hist.maxChargePowerForDay = data.buffer.readInt16BE(8);       // 0x010F
        hist.maxDischargePowerForDay = data.buffer.readInt16BE(10);   // 0x0110
        hist.chargeingAmpHoursForDay = data.buffer.readInt16BE(12);   // 0x0111
        hist.dischargingAmpHoursForDay = data.buffer.readInt16BE(14); // 0x0112
        hist.powerGenerationForDay = data.buffer.readInt16BE(16);     // 0x0113
        hist.powerConsumptionForDay = data.buffer.readInt16BE(18);    // 0x0114

        callback(null, hist);
    });
}

//
// callback(error, data)
//
// data is Buffer type.
//
RenogyRover.prototype.readHoldingRegisters = function(base, length, callback)
{
    var self = this;

    try {

        //
        // apis/promise.js
        //    cl.readHoldingRegisters = _convert(cl.writeFC3);
        //      index.js
        //        ModbusRTU.prototype.writeFC3 = function(address, dataAddress, length, next) {
        //          this.writeFC4(address, dataAddress, length, next, 3);
        //        };
        //
        // modbus FC3 command.
        //
        self.client.readHoldingRegisters(base, length, function(err, data) {

            if (err != null) {
                if (self.trace) {
                    console.log("readHoldingRegisters err=");
                    //console.log(err);
                    dumpasjson(err);
                }
            }

            if (data != null) {
                if (self.trace) {
                    console.log("data.data=");
                    console.log(data.data);
                }
            }

            callback(err, data);
        });
    }
    catch(e) {
        if (self.trace) {
            console.log("readHoldingRegisters exception=");
            console.log(e);
        }
        callback(e, null);
    }
}



function dumpasjson (ob) {

      var util = require('util');

      //
      // Dump data as JSON
      //
      // null is full depth, default is 2
      //
      // http://nodejs.org/api/util.html#util_util_inspect_object_options
      //
      //var inspectOptions = { showHidden: true, depth: null };
      //
      var inspectOptions = { showHidden: true, depth: null,
                       customInspect: false, colors: true };

      var dumpdata = util.inspect(ob, inspectOptions);

      console.log(dumpdata);
}

RenogyRover.prototype.tracelog = function(config, message) {
    if (this.trace) {
        console.log(message);
    }
}

RenogyRover.prototype.errlog = function(message) {
    if (this.traceError) {
        console.error(message);
    }
}

module.exports = {
  RenogyRover: RenogyRover
};

//
// These values are from the document "ROVER MODBUS.docx" supplied by Renogy Inc.
// customer service to the author in October 2017.
//
// note count () is in bytes. Modbus registers are two bytes each
// and modbus addresses are 16 bit word addresses, not byte addresses.
//
// 0x0000 (20) - Reserved.
//
// 0x000A (2) - Operating Parameters
//
//               Upper 8 bits max voltage support by the system
//
//               0CH (decimal 12)	12V	
//               18H (decimal 24)	24V	
//               24H (decimal 36)	36V	
//               30H (decimal 48)	48V	
//               60H (decimal 96)	96V	
//               FFH (decimal 255)	Automatic recognition of system voltage	
// 
//               Lower 8 bits max rated charging current
// 
//               0AH (decimal 10)	10A	
//               14H (decimal 20)	20A	
//               1EH (decimal 30)	30A	
//               2DH (decimal 45)	45A  	
//               3CH (decimal 60)	60A
//
// 0x000B (2) - Operating Parameters 2
//
//               Upper 8 bits rated discharging current
//
//               0AH (decimal 10)	10A	
//               14H (decimal 20)	20A	
//               1EH (decimal 30)	30A	
//               2DH (decimal 45)	45A  	
//               3CH (decimal 60)	60A	
//
//               Lower 8 bits product type
//
//               00 (controller)
//               01 (inverter)
//               ...
//
// 0x000C (16) - Product Model.
// 0x0018 (4)  - product serial number
//
// 0x0100 (2) - Battery capacity SOC (state of charge)
// 0x0101 (2) - Battery voltage * 0.1
// 0x0102 (2) - Charging current to battery * 0.01
// 0x0103 (2) - Upper byte controller temperature bit 7 sign, bits 0 - 6 value
//            - Lower byte battery temperature bit 7 sign, bits 0 - 6 value
// 0x0107 (2) - Solar panel voltage  * 0.1
// 0x0108 (2) - Solar panel current * 0.01
// 0x0109 (2) - Charging Power actual value
// 0x010A (2) - light on/off command (write only 0 for off, 1 for on)
// 0x010B (2) - Battery min voltage of current day * 0.1
// 0x010C (2) - Battery max voltage of current day * 0.1
// 0x010D (2) - max charging current of current day * 0.01
// 0x010E (2) - max discharging current of current day * 0.01
// 0x010F (2) - max charging power of the current day actual value
// 0x0110 (2) - max discharging power of the current day actual value
// 0x0111 (2) - charging amp hours of the current day actual value
// 0x0112 (2) - discharging amp hours of the current day actual value
// 0x0113 (2) - power generation of the current day actual value
// 0x0114 (2) - power consumption of the current day actual value
//
// Historical Information
//
// 0x0115 (2) - total number of operating days
// 0x0116 (2) - total number of battery over-discharges
// 0x0117 (2) - total number of battery full discharges
// 0x0118 (4) - total charging amp-hrs of the battery actual value
// 0x011A (4) - total discharging amp-hrs of the battery actual value
// 0x011C (4) - cumulative power generation actual value
// 0x011E (4) - cumulative power consumption actual value
//
// 0x0120 (2) - charging state in 8 lower bits.
//            00H: charging deactivated
//            01H: charging activated
//            02H: mppt charging mode
//            03H: equalizing charging mode
//            04H: boost charging mode
//            05H: floating charging mode
//            06H: current limiting (overpower)
//
//            - upper 8 bits are street light status and brightness.
//
// 0x0121 (4) - controller fault and warning information
//            - 32 bit value of flags
//
//            B24: photovoltaic input side short circuit 
//            B23: photovoltaic input overpower
//            B22: ambient temperature too high
//            B21: controller temperature too high
//            "B20: load overpower
//               or load over-current"
//            B19: load short circuit
//            B18: battery under-voltage warning
//            B17: battery over-voltage
//            B16: battery over-discharge
//            B0-B15 reserved
//
// Exxx range are read/write registers for setting various parameters.
// more are available than listed here.
//
// 0xE0002 (2) - nominal battery capacity
// 0xE0003 (2) - system voltage setting, recognized voltage
// 0xE0004 (2) - battery type open, sealed, gel, lithium, self-customized.
// 0xE0005 (2) - overvoltage threshhold 70 - 170
//
// 0xF000  (2) - Historical data of the current day
// 0xF001  (2) - Data before the current day
//
