require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const Jimp = require('jimp');
const QrCode = require('qrcode-reader');
const fs = require('fs');
const path = require('path');

const environment = process.env.ENVIRONMENT;
const token = environment === 'dev' ? process.env.DEV_TOKEN : process.env.PROD_TOKEN;

const bot = new TelegramBot(token, { polling: true });

bot.on('message', async (msg) => {
  if (msg.photo) {
    const chatId = msg.chat.id;

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

    // Read the QR code
    Jimp.read(fileName, (err, image) => {
      if (err) {
        console.error(err);
        bot.sendMessage(chatId, 'Error al leer la imagen.');
        return;
      }

      const qr = new QrCode();
      qr.callback = (error, value) => {
        if (error) {
          console.error(error);
          bot.sendMessage(chatId, 'No se pudo detectar un código QR en la imagen.');
          return;
        }

        bot.sendMessage(chatId, `Código QR detectado: ${value.result}`);
      };
      qr.decode(image.bitmap);
    });
  }
});
