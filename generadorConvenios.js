const xlsx = require('xlsx');
const ObjectsToCsv = require('objects-to-csv');
const path = require('path');
const fs = require('fs');
const dotenv = require("dotenv");
const puppeteer = require('puppeteer');
const sleep = require('sleep-promise');
const nodemailer = require('nodemailer');
const funciones = require('./funciones/funcionesConvenios');
const bdfunction = require('./funciones/funcionesBD')
dotenv.config();

//Funciones
(async () => {
    //Abrir archivo (TARIFAS Y SUPLEMENTOS) del DAT//Validar Carga de Tarifas 171704 NEW gvfaag CONVENIO DE PRUEBA 6
    let taskname = 'BD - CHANGED RFP 5086 - EXXON MOBIL (USA)'
    //tafifas muy bajas '213780 UPD miguel.mora VOLKSWAGEN DE MEXICO'
    //tafifas bajas  linea 396'BD - CHANGED RFP 5086 - EXXON MOBIL (USA)'
    //'214897 UPD ventas2fitep ARABELA SA DE CV'//'215057 UPD ventas1fippb SUMITOMO ELECTRIC HARD METAL DE MEXICO SA DE CV'//'214620 UPD ventasfavz SUMITOMO ELECTRIC HARDMETAL DE MEXICO SA DE CV'//'214922 UPD miguel.mora LABORATORIOS SANFER SA DE CV'//'214923 UPD miguel.mora OPERADORA WAL MART S DE RL DE CV'//'214431 UPD oscar.herrera SANTANDER SERFIN'//"213422 UPD miguel.mora OPERADORA WAL MART S DE RL DE CV"//"199242 REG betzabe.arreola HILTI MEXICANA SA DE CV"//"197372 REG betzabe.arreola WORLEY ENGINEERING DE MEXICO" //"192947 NEW karla.delarue ENERGIA NUEVA ENERGIA LIMPIA DE MEXICO S DE RL DE CV"
    console.log('INICIANDO generadorConvenios')
    let a = await funciones.procesoGeneracionLeyendas(taskname)
    console.log(a)
    //await funciones.enviaCorreo(a.bodyGDL)
    //await funciones.checkUpdatedFiles()
})().catch((e) => {
    console.log("EL RPA HA DETECTADO UN ERROR!")
    console.log(e);
    console.log("Favor de revisar")
});


