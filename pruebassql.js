const puppeteer = require('puppeteer');
const sleep = require('sleep-promise');
const path = require('path');
const fs = require('fs');
const dotenv = require("dotenv");
const nodemailer = require('nodemailer');
const funciones = require('./funciones/funcionesConvenios');
const funcionesBD = require('./funciones/funcionesBD');
dotenv.config();
//  -   -   -   -   -   -   -   -   -   -    I M P R I M E - L I N E A -   -   -   -   -   -   -   -   -   -

Object.defineProperty(global, '__stack', {
    get: function () {
        var orig = Error.prepareStackTrace;
        Error.prepareStackTrace = function (_, stack) {
            return stack;
        };
        var err = new Error();
        Error.captureStackTrace(err, arguments.callee);
        var stack = err.stack;
        Error.prepareStackTrace = orig;
        return stack;
    },
});

Object.defineProperty(global, '__line', {
    get: function () {
        return __stack[1].getLineNumber();
    },
});

Object.defineProperty(global, '__function', {
    get: function () {
        return __stack[1].getFunctionName();
    },
});

//  -   -   -   -   -   -   -   E R R O R - N O - T R A T A D O -   -   -   -   -   -  -   -  -  -

process
    .on('uncaughtException', async (error) => {
        //await sendXiraEmailError(error);
        console.error(`Se envió notificación de la falla: ${error.stack || error}`);
    })
    .on('unhandledRejection', async (error) => {
        //await sendXiraEmailError(error);
        console.error(`Se envió notificación de la falla: ${error.stack || error}`);
    });

(async () => {
    console.log("inicio")
    let a="BD - RENOVATION RFP 3832 - BORR DRILLING (USA)"
    let iderror = await funcionesBD.consigueIDTareaError(a)
    await funcionesBD.actualizaTareaError(iderror, funcionesBD.generaFechaSQL())
    console.log("Archivo procesado con error nuevamente, se espera a próximo día")
});