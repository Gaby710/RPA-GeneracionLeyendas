const dotenv = require("dotenv");
const nodemailer = require('nodemailer');
dotenv.config();
enviaCorreo("Buen día, esta es una prueba de funcionamiento de notificaciones, Se añadió el correo soporte.convenios@posadas.com a lista de distribución, favor de confirmar de recibido, Muchas gracias.")
 function enviaCorreo(stringmail,cuenta="",numsol="") {
    const mailOptions = {
        from: 'RPA GENERACIÓN DE LEYENDAS CONVENIOS <infobot@xira-intelligence.com>',
        //to: 'juan.calvillo@posadas.com,cesar.diaz@posadas.com,rosaurora.espinoza@posadas.com,flor.aguilar@posadas.com,soporte@xira.com.mx,soporte.convenios@posadas.com',
        to:'areyes@xira.com',
        subject:"Prueba Correos RPA Leyendas",
        text: stringmail,
        html: '',
    };

    const transporter = nodemailer.createTransport({
        host: process.env.HOST_EMAIL,
        port: process.env.PORT,
        auth: {
            user: process.env.CORREO,
            pass: process.env.PASS_MAIL,
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    return new Promise((resolve) => {
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error(error);
                resolve();
                return;
            }

            console.log(JSON.stringify(info));
            console.log('Se envia enviaCorreo a soporte.convenios@posadas.com');
            resolve();
            return;
        });
    });
}
