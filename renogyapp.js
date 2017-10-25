
//
// 10/21/2017
//
// Renogy Rover 20/40 AMP MPPT controller App.
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

var rover = require('./renogy-rover.js');

var g_trace = false;
var g_traceError = true;

var g_compactJSONOutput = false;

//
// Monitor loop for Renogy Rover MPPT Controller.
//
// Identifies product model, then goes into a loop dumping
// real time and longer term variables at their configured
// intervals.
//
function monitorLoop(port, monitor_interval)
{
    console.log("renogy-rover monitor loop");

    var config = {};

    config.trace = g_trace;
    config.traceError = g_traceError;

    config.port = port;

    // use defaults
    //config.baudrate = g_modbusBaudRate;
    //config.modbusID = g_modbusID;
    //config.modbusTimeout = g_modbusTimeout;

    var renogy = new rover.RenogyRover(config);

    renogy.connect(function(result) {

        if (result != null) {
            console.log("connect error result=" + result);
            return;
        }

        console.log("connected...");

        renogy.getProductModel(function(error, model) {
            if (error != null) {
                console.log("error reading model error=" + error);
            }
            else {
                console.log("Renogy Model is: ");
                console.log(model);
            }

            if (model.indexOf("ML2420N") != -1) {
                console.log("model ML2420N supported by this application identified");
            }
            else {
                console.log("Warning Model not tested model=" + model);
            }

            console.log("");

            //
            // Do one pass right away, then on the supplied interval
            //
            getReadings(renogy, function(error2, readings) {
                printReadings(readings);
            });

            var intervalObject = setInterval(monitorPass, monitor_interval * 1000, renogy);
        });
    });
}

//
// A monitor pass runs every timeout interval.
//
// callback(error, readings)
//
function monitorPass(renogy)
{

    getReadings(renogy, function(error, readings) {

        //
        // Here you would log, send to the cloud, etc.
        //
        if (error == null) {
            printReadings(readings);
        }
        else {
            console.log("");
            console.log(new Date(Date.now()).toISOString() + ":");
            console.log("error getting readings error=" + error);
        }
    });
}

//
// Get Readings from the Renogy Rover MPPT controller.
//
// callback(error, readings)
//
function getReadings(renogy, callback)
{
    var readings = {};

    readings.date = new Date(Date.now());

    readings.panel = null;
    readings.panelError = null;

    readings.battery = null;
    readings.batteryError = null;

    readings.historical = null;
    readings.historicalError = null;

    //
    // Get panel state
    //
    renogy.getPanelState(function(error2, panelState) {

        if (error2 != null) {
            readings.panelError = error2;
        }
        else {
            readings.panel = panelState;
        }

        //
        // Get Battery State
        //
        renogy.getBatteryState(function(error3, batteryState) {
            if (error3 != null) {
                readings.batteryError = error3;
            }
            else {
                readings.battery = batteryState;
            }

            //
            // Get historical (long running) parameters
            //
            renogy.getHistoricalParameters(function(error4, historicalParameters) {
                if (error4 != null) {
                    readings.historicalError = error4;
                }
                else {
                    readings.historical = historicalParameters;
                }

                callback(null, readings);
            });
        });
    });
}

//
// Output as JSON text suitable for logging, cloud HTTP REST uploads, etc.
//
var util = require('util');

function outputReadingsAsJSON(readings)
{
    var jsonText;

    if (g_compactJSONOutput) {
        // This is best for logging, sending remote, etc.
        jsonText = JSON.stringify(readings);
    }
    else {
        // use node.js pretty print for local print.
        var inspectOptions = { showHidden: false, depth: null,
                         customInspect: false, colors: false };

        jsonText = util.inspect(readings, inspectOptions);
    }

    console.log(jsonText);
}

function printReadings(readings)
{
    //
    // Only do detailed print when trace is required.
    //

    if (!g_trace) {
        outputReadingsAsJSON(readings);
        return;
    }

    console.log("");
    console.log(readings.date.toISOString() + ":");

    if (readings.panelError != null) {
        console.log("error reading panel state error=" + readings.panelError);
    }
    else {
        console.log("Panel Voltage is: " + readings.panel.voltage);
        console.log("Panel Current is: " + readings.panel.current);
        console.log("Charging power is: " + readings.panel.chargingPower);
    }

    if (readings.batteryError != null) {
        console.log("error reading battery state error=" + readings.batteryError);
    }
    else {
        console.log("Battery stateOfCharge is: " + readings.battery.stateOfCharge); 
        console.log("Battery voltage is: " + convert10thUnits(readings.battery.voltage)); 
        console.log("Battery chargingCurrent is: " + convert100thUnits(readings.battery.chargingCurrent)); 
        console.log("Battery controllerTemperature is: " + readings.battery.controllerTemperature); 
        console.log("Battery batteryTemperature is: " + readings.battery.batteryTemperature); 
    }

    if (readings.historicalError != null) {
        console.log("error reading battery state error=" + readings.historicalError);
    }
    else {
        console.log("Historical Parameters=");
        console.log(readings.historical);
    }
}

function convert100thUnits(value)
{
    return value / 100;
}

//
// Unit is 0.1 the value.
//
function convert10thUnits(value)
{
    return value / 10;
}

function main(ac, av)
{
    var port = null;
    var monitor_interval = 60;

    if (process.env.RENOGY_ROVER_INTERVAL != null) {
        monitor_interval = parseInt(process.env.RENOGY_ROVER_INTERVAL);
    }

    if (ac == 1) {

        //
        // if no port see if its in the environment.
        //
        if (process.env.RENOGY_ROVER_PORT != null) {
            port = process.env.RENOGY_ROVER_PORT;
        }
        else {
            usage("must set RENOGY_ROVER_PORT environment variable, or supply as an argument.");
            process.exit(1);
        }
    }
    else if (ac == 2) {
        port = av[1];
    }
    else if (ac == 3) {
        port = av[1];
        monitor_interval = av[2];
    }
    else {
        usage("improper number of arguments " + ac);
        process.exit(1);
    }

    console.log("port=" + port, " monitor_interval=" + monitor_interval);

    monitorLoop(port, monitor_interval);
    return;
}

function usage(message) {

    if (message != null) {
        console.error(message);
    }

    console.error("renogyapp port monitor_interval_in_seconds");

    process.exit(1);
}

var util = require('util');

function dumpasjson (ob) {

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

//
// Remove argv[0] to get to the base of the standard arguments.
// The first argument will now be the script name.
//
var args = process.argv.slice(1);

// Invoke main
main(args.length, args);

