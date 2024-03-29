var noble = require('noble');
var inform = require('../WebsocketServer/Websocket').Sensor;
const uuidv1 = require('uuid/v1');
var biosignal = require('../models/biosignal');

var ble = {};

var bufferPulse = [];
var bufferSpO2 = [];
var bufferPi = [];
var bufferDate = [];
var index = 0;
var status = "";
const BIO_BUFFER_SIZE = 10;
var SLIDING_WINDOW = [];
var SLIDING_WINDOW_MAX_LENGHT = 5;


noble.on('stateChange', function (state) {
    console.log(state);
    if (state === 'poweredOn') {
        status = "Disconnected / Scanning";
        noble.startScanning(['cdeacb8052354c07884693a37ee6b86d'], true);
    } else {
        status = "No BLE Available / NOT Scanning";
        noble.stopScanning();
    }
});

connecting = false;
var informClient = false;

//oximeter
noble.on('discover', function (peripheral) {
    console.log('Found device with local name: ' + peripheral.advertisement.localName);
    console.log('advertising the following service uuid\'s: ' + peripheral.advertisement.serviceUuids);
    console.log();

    if (peripheral.advertisement.localName === 'Medical' && !connecting) {
        connecting = true;
        noble.stopScanning();
        peripheral.connect(function (error) {
            console.log('connected to peripheral: ' + peripheral.uuid);
            status = "Connected to Medical";
            peripheral.discoverServices(['cdeacb8052354c07884693a37ee6b86d'], function (error, services) {
                console.log('discovered services');
                var oximeterService = services[0];
                oximeterService.discoverCharacteristics(['cdeacb8152354c07884693a37ee6b86d'], function (error, characteristics) {
                    console.log('discovered characteristics');
                    var oximeterChar = characteristics[0];
                    oximeterChar.on('data', function (data, isNotification) {
                        if (data.length === 11 && (data[0] & 0xff) === 0x80) {
                            processPpg(data);
                        } else if (data.length === 4 && (data[0] & 0xff) === 0x81) {
                            processSpO2(data);

                        }
                    });
                    oximeterChar.notify(true, function (error) {
                        console.log('Measurement notification on');
                    });
                });
            });
        });
        peripheral.once('disconnect', function () {
            console.log('disconnected');
            status = "Disconnected / Scanning";
            SLIDING_WINDOW = [];
            inform({Saturation:null, HeartRate: null, status: status,stable:'No'});
            noble.startScanning(['cdeacb8052354c07884693a37ee6b86d'], true);
            connecting = false;
            bufferPulse = [];
            bufferSpO2 = [];
            bufferPi = [];
            bufferDate = [];
        });
    }
});

function bufferPush(pulse, spO2, pi, date) {
    if (index < BIO_BUFFER_SIZE) {
        index++;
    } else {
        bufferPulse.splice(0, 1);
        bufferSpO2.splice(0, 1);
        bufferPi.splice(0, 1);
        bufferDate.splice(0, 1);
    }
    bufferPulse.push(pulse);
    bufferSpO2.push(spO2);
    bufferPi.push(pi);
    bufferDate.push(date);
}

function processPpg(data) {
    var ppg = [];
}

function processSpO2(data) {
    var pulse = data[1] & 0xff;
    var SpO2 = data[2] & 0xff;
    var pi = data[3] & 0xff;
    status = "Measuring";
    if (pulse !== 255 && SpO2 !== 127) {
        bufferPush(pulse, SpO2, pi, d);
        var d = new Date();
        d.setMilliseconds(0);

        var Saturation = {
            x: d.getTime(),
            y: SpO2
        };
        var HeartRate = {
            x: d.getTime(),
            y: pulse
        };

        proccess(SpO2, pulse);

    }
}

ble.getData = function () {
    return {
        'pulse': bufferPulse,
        'SpO2': bufferSpO2,
        'pi': bufferPi,
        'status': status,
        'date': bufferDate
    };
};

ble.getDataSize = function () {
    return BIO_BUFFER_SIZE;
};

module.exports = ble;

function proccess(Saturation, HeartRate){

    var d = new Date();
    d.setMilliseconds(0);

    var SaturationMes = {
        x: d.getTime(),
        y: Saturation
    };
    var HeartRateMes = {
        x: d.getTime(),
        y: HeartRate
    };

    if(SLIDING_WINDOW.length < SLIDING_WINDOW_MAX_LENGHT){
        var measurement ={
            Saturation :Saturation,
            HeartRate: HeartRate
        };
        SLIDING_WINDOW.push(measurement);
        inform({Saturation: SaturationMes, HeartRate: HeartRateMes, status: status,stable:'No'});
    }
    else if(SLIDING_WINDOW.length === SLIDING_WINDOW_MAX_LENGHT){
        var totalHeart = 0;
        var totalBlood = 0;
        var avgHeart ;
        var avgBlood ;
        for(var i = 0; i < SLIDING_WINDOW.length; i++) {
            totalHeart += SLIDING_WINDOW[i].HeartRate;
            totalBlood +=SLIDING_WINDOW[i].Saturation;
        }
        avgHeart = totalHeart / SLIDING_WINDOW.length;
        avgBlood = totalBlood / SLIDING_WINDOW.length;


        var mes ={
            Saturation :Saturation,
            HeartRate: HeartRate
        };
        SLIDING_WINDOW.splice(0,1);
        SLIDING_WINDOW.push(mes);

        //We have stable measurement
        if(Math.abs(avgHeart-HeartRate) <=1 && Math.abs(avgBlood - Saturation) <=1){
                console.log('Steady data');
                Save(Saturation,HeartRate);
            inform({Saturation: SaturationMes, HeartRate: HeartRateMes, status: status,stable:'Yes'});
        }
        else
            inform({Saturation: SaturationMes, HeartRate: HeartRateMes, status: status,stable:'No'});

    }
}

function Save(Saturation, HeartRate) {
    var BloodSaturation = new biosignal({
        date_taken: new Date(),
        type: 'blood_saturation',
        source: 'sensed',
        measurement: {
            value: Saturation,
            unit: 'SO2'
        },
        uniqueId: uuidv1()
    });
    var Heart_Rate = new biosignal({
        date_taken: new Date(),
        type: 'heart_rate',
        source: 'sensed',
        measurement: {
            value:HeartRate,
            unit: 'bpm'
        },
        uniqueId: uuidv1()
    });
    BloodSaturation.save(function (err1,res1) {
        if(err1)
            console.log(err1);
        else {
            Heart_Rate.save(function(err2,res2){
                if(err2)
                    console.log(err2);
            })
        }
    })
}