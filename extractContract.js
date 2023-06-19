const xlsx = require('xlsx');
const ObjectsToCsv = require('objects-to-csv');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

//Funciones
(async () => {
    await checkFiles()
})().catch((e) => {
    console.log("EL RPA HA DETECTADO UN ERROR!")
    console.log(e);
    console.log("Favor de revisar")
});


async function checkFiles() {
    const files = await fs.promises.readdir("C:\\Users\\Administrator\\Desktop\\GeneracionLeyendas\\RPA Convenios\\archivosdat");
    if (files.length > 0) {
        console.log('Hay nuevos archivos, actualizando....');
        let text=""
        for (const file of files) {
            let contrato = await retrieveContract(file)
            console.log(file +":"+contrato)
            text = text+"Archivo"+file +",Contrato:"+contrato+",\n"
        }
       await fs.writeFileSync('Contratos.txt', text)
    } else {
        console.log('No hay nuevos archivos, retomando flujo normal');
    }
}

async function retrieveContract(filename){
    let wb = xlsx.readFile(path.join(process.env.DOWNLOAD_PATH, filename), { cellText: false, cellDates: true, dateNF: false });
    let first_sheet_name = wb.SheetNames[0];
    let worksheet = wb.Sheets[first_sheet_name];
    let range = xlsx.utils.decode_range(worksheet['!ref']);
    let shift = 0;
    contrato = worksheet[xlsx.utils.encode_cell({ r: 1, c: 24 })].v;
    let isnum = /^\d+$/.test(contrato);
    if (isnum) {
        contrato = worksheet[xlsx.utils.encode_cell({ r: 1, c: 25 })].v;
        shift = 1;
    }
    return contrato
}