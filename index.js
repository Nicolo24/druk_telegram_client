require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const Jimp = require('jimp');
const QrCode = require('qrcode-reader');
const fs = require('fs');
const path = require('path');
const winston = require('winston');

const environment = process.env.ENVIRONMENT;
const token = environment === 'dev' ? process.env.DEV_TOKEN : process.env.PROD_TOKEN;

const bot = new TelegramBot(token, { polling: true });

// Configuración de Winston para los logs
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.printf(info => `${info.timestamp} - ${info.level}: ${info.message}`)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'bot.log' })
  ]
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  logger.info(`Mensaje recibido en el chat ${chatId}`);

  if (msg.photo) {
    logger.info(`Foto recibida en el chat ${chatId}`);
    
    try {
      // Get the file ID of the highest resolution photo
      const fileId = msg.photo[msg.photo.length - 1].file_id;

      // Get the file path
      const file = await bot.getFile(fileId);
      const filePath = file.file_path;

      // Download the file
      const url = `https://api.telegram.org/file/bot${token}/${filePath}`;
      const response = await axios({
        url,
        responseType: 'arraybuffer'
      });

      // Save the file locally
      const fileName = path.join(__dirname, 'downloaded_image.jpg');
      fs.writeFileSync(fileName, response.data);
      logger.info(`Imagen descargada y guardada como ${fileName}`);

      // Read the QR code
      Jimp.read(fileName, (err, image) => {
        if (err) {
          logger.error(`Error al leer la imagen: ${err.message}`);
          bot.sendMessage(chatId, 'Error al leer la imagen.');
          return;
        }

        const qr = new QrCode();
        qr.callback = (error, value) => {
          if (error) {
            logger.error(`No se pudo detectar un código QR en la imagen: ${error.message}`);
            bot.sendMessage(chatId, 'No se pudo detectar un código QR en la imagen.');
            return;
          }

          logger.info(`Código QR detectado: ${value.result}`);
          bot.sendMessage(chatId, `Código QR detectado: ${value.result}`);
        };
        qr.decode(image.bitmap);
      });
    } catch (error) {
      logger.error(`Error procesando la foto: ${error.message}`);
      bot.sendMessage(chatId, 'Ocurrió un error procesando la foto.');
    }
  } else {
    logger.info(`Mensaje sin foto recibido en el chat ${chatId}`);
  }
});
