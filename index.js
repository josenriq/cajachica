if (!process.env.SLACK_TOKEN) {
  console.log('Error: Specify SLACK_TOKEN in environment');
  process.exit(1);
}
if (!process.env.FIREBASE_API_KEY || !process.env.FIREBASE_DATABASE_URL) {
  console.log('Error: Specify FIREBASE_API_KEY and FIREBASE_DATABASE_URL in environment');
  process.exit(1);	
}

var Botkit = require('botkit/lib/Botkit.js');
var firebase = require('firebase');
var numeral = require('numeral');
var moment = require('moment');

firebase.initializeApp({
  apiKey: process.env.FIREBASE_API_KEY,
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

var controller = Botkit.slackbot({
	debug: false
});

controller.spawn({
  token: process.env.SLACK_TOKEN
}).startRTM(function(err) {
  if (err) {
    throw new Error(err);
  }
});

function getTotal() {
	return firebase.database().ref('/cajachica').once('value').then(function(snapshot) {
		return snapshot.val().total;
	});
}

function setTotal(total) {
	firebase.database().ref('/cajachica').set({
		total: total
	});
}

function addToTotal(value) {
	return getTotal().then(function(total) {
		var newTotal = total + value;
		setTotal(newTotal);
		return newTotal;
	});
}

function addTransaction(value, description) {
	var transaction = firebase.database().ref('/transactions').push();
  return transaction.set({
  	createdAt: Date.now(),
  	amount: value,
  	description: description && description.length > 0 ? description : '(Sin descripción)'
  });
}

function listTransactions() {
	return firebase.database().ref('/transactions').once('value').then(function(snapshot) {
		return snapshot.val();
	});
}

function toPrettyNumber(number, quotes) {
	var str = numeral(number).format('0,0.00');
	if (quotes !== false)
		str = '`' + str + '`';
	return str;
}

function findNumber(message) {
	var parts = message.split(/\s+/);
	for (var i = 0; i < parts.length; i++) {
		var value = parseFloat(parts[i], 10);
		if (!isNaN(value))
			return value;
	}
	return null;
}

controller.hears(['reset', 'reiniciar'], ['direct_message', 'direct_mention', 'mention'], function(bot, message) {
	bot.startConversation(message, function(error, convo) {
		convo.ask('Ok. ¿Con cuánto reinicio la cuenta?', function(response, convo) {
			var number = findNumber(response.text);
			if (!number && number !== 0) {
				convo.say('¡No dijiste ningún número! Así no se puede... chao');
			}
			else {
				setTotal(number);
				addTransaction(number, '(Reset)');
				convo.say('Listo. La cuenta ahora es ' + toPrettyNumber(number));
			}
			convo.next();
		});
	});
});

controller.hears(['remover', 'restar', 'gasto', 'subtract', 'decrease', 'expense'], ['direct_message', 'direct_mention', 'mention'], function(bot, message) {
	bot.startConversation(message, function(error, convo) {
		convo.ask('¿Cuánta plata querés restar?', function(response, convo) {
			var number = findNumber(response.text);
			if (!number && number !== 0) {
				convo.say('¡No dijiste ningún número! Así no se puede... chao');
			}
			else {
				addToTotal(-number).then(function(newTotal) {
					convo.ask('Listo. Resté ' + toPrettyNumber(number) + ' y el total ahora es ' + toPrettyNumber(newTotal) + '. ¿En qué gastaste esta plata?', function(response, convo) {
						addTransaction(-number, response.text);

						if (/birra|cerveza|guaro|drogas|weed/i.test(response.text)) {
							convo.say('Ah bueeeno, mientras haya sido en eso todo bien!');
						}
						else if (/que le importa|qué le importa|what do you care|what do u care|fuck you/i.test(response.text)) {
							convo.say('Está bien. Comé mucha *** entonces!');
						}
						else {
							convo.say('Ok listo :)');
						}
						convo.next();
					});
				});
			}
			convo.next();
		});
	});
});

controller.hears(['agregar', 'añadir', 'sumar', 'add', 'increase'], ['direct_message', 'direct_mention', 'mention'], function(bot, message) {
	bot.startConversation(message, function(error, convo) {
		convo.ask('¿Cuánta plata querés añadir?', function(response, convo) {
			var number = findNumber(response.text);
			if (!number && number !== 0) {
				convo.say('¡No dijiste ningún número! Así no se puede... chao');
			}
			else {
				addTransaction(number, '(Abono)');
				addToTotal(number).then(function(newTotal) {
					convo.say('Listo. Añadí ' + toPrettyNumber(number) + ' y el total ahora es ' + toPrettyNumber(newTotal));
				});
			}
			convo.next();
		});
	});
});

controller.hears(['listar', 'reporte', 'transacciones', 'list', 'report', 'transactions'], ['direct_message', 'direct_mention', 'mention'], function(bot, message) {
	return listTransactions().then(function(transactions) {
		var attachments = [];
		Object.keys(transactions).forEach(function(key) {
			var transaction = transactions[key];
			attachments.push({
				title: toPrettyNumber(transaction.amount, false) + ' => ' + transaction.description,
				color: transaction.amount < 0 ? '#c0392b' : '#27ae60',
				fields: [{
					label: 'Date',
					value: moment(transaction.createdAt).format('dddd, MMMM Do YYYY')
				}]
			});
		});
		bot.reply(message, {
			text: 'Aquí va el reporte',
			attachments: attachments
		});
	});
});

controller.hears(['hello', 'hi', 'hola', 'holis', 'status', 'cuánto', 'cuanto', 'cuenta', 'how much'], ['direct_message', 'direct_mention', 'mention'], function(bot, message) {
	return getTotal().then(function(total) {
		bot.reply(message, 'Yo yo! Ahorita tengo ' + toPrettyNumber(total) + ' en mi panza.');
	});
});
