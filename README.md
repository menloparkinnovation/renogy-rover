
# renogy-rover

A pure Javascript driver for the Renogy Rover 20/40 AMP MPPT controller.

[![NPM download](.svg)](npm path)
[![NPM version](picture.png)]()
[![Build Status](master)]()

The Renogy Rover is a Maximum Power Point Tracking (MPPT) solar power
system controller available for 20 or 40 amps. It provides a modbus
protocol for monitoring real time or historical data.

This module allows use of a small computer such as a RaspberryPi to
remotely monitor a solar power system and communicate with the cloud.

It uses modbus-serial npm for the low level modbus transactions.

**This package allows monitoring solar power systems.

----

- [What can I do with this module ?](#what-can-i-do-with-this-module-)
- [Compatibility](#compatibility)
- [Examples](#examples)
- [Methods](https://github.com/yaacov/node-modbus-serial/wiki/Methods)

----

#### Install

    npm install renogy-rover

#### What can I do with this module ?

Monitor solar power systems with a RaspberryPi, Linux computer,
PC, or Mac.

#### Compatibility

###### Functions implemented:

* connect

* getProductModel

* getPanelState

* getBatteryState

* getHistoricalParameters

#### Examples

###### Connect

    var config = {};
    config.port = port;

    var renogy = new rover.RenogyRover(config);

    renogy.connect(function(error) {
        // .. connected
    });

###### Get Product Model

    renogy.getProductModel(function(error, model) {
        console.log("Renogy Model is: ");
        console.log(model);
    });

###### Get Panel State

    renogy.getPanelState(function(error, panelState) {
        console.log("panelState=");
        console.log(panelState);
    });

###### Get Battery State

    renogy.getBatteryState(function(error, batteryState) {
        console.log("batteryState=");
        console.log(batteryState);
    });

###### Get Historical Parameters

    renogy.getHistoricalParameters(function(error, historicalParameters) {
        console.log("historicalParameters=");
        console.log(historicalParameters);
    });

###### Monitoring Utility

export RENOGY_ROVER_PORT=/dev/someport

export RENOGY_ROVER_INTERVAL=30

npm start
