import {spawn} from 'child_process'
import nodemailer from 'nodemailer'

import GoogleApis from 'googleapis'
const {google} = GoogleApis

import MailParserMIT from 'mailparser-mit'
const {MailParser} = MailParserMIT

export async function run(getRawEmails) {
	for await (let rawEmail of getRawEmails()) {
		try {
			var email = await parseEmail(rawEmail)
			const text = await pdfToText(email.attachments[0].content, process.env.PDF_PASSWORD)
			const transactions = await parseText(text)
			const result = await appendTransactions(transactions)
			reply(email, result)
		}
		catch (e) {
			reply(email, e)
		}
	}
}

async function parseEmail(input) {
	return new Promise((resolve) => {
		const parser = new MailParser()
		parser.on('end', resolve)
		input.pipe(parser)
	})
}

async function pdfToText(pdf, password) {
	const process = spawn('pdftotext', [
		'-upw',
		password,
		'-layout',
		'-',
		'-',
	])

	process.stdin.end(pdf)

	let stderr = ''
	for await (const err of process.stderr) {
		stderr += err
	}

	let stdout = ''
	for await (const out of process.stdout) {
		stdout += out
	}

	return stdout
}

function floatFromString(value) {
	return parseFloat(value.replace(/\s+/, '').replace(',', '.'))
}

function parseText(text) {
	let data = [];
	const lines = text.split('\n');
	const columns = [
		{
			pattern: 'Provedení',
			start: null,
			length: null,
		},
		{
			pattern: 'Kód transakce',
			start: null,
			length: null,
		},
		{
			pattern: 'Číslo účtu \\/ debetní karty',
			start: null,
			length: null,
		},
		{
			pattern: 'Detaily',
			start: null,
			length: null,
		},
		{
			pattern: 'Částka CZK',
			start: null,
			length: null,
		},
		{
			pattern: 'Poplatky',
			start: null,
			length: null,
		},
	];

	const columnsRegexp = columns.map((col) => {
		return `(${col.pattern}\\s*)`;
	}).join('');

	let i = 0;
	while (i < lines.length) {
		let line = lines[i];

		const columnsMatches = line.match(columnsRegexp);
		if (columnsMatches) {
			columns.forEach((col, colIndex) => {
				if (colIndex === 0) {
					col.start = columnsMatches.index;
				}
				else {
					const prevCol = columns[colIndex - 1];
					col.start = prevCol.start + prevCol.length
				}
				col.length = columnsMatches[colIndex + 1].length;
			});
		}
		else if (line.match(/^\s*\d\d\.\d\d\.\d\d\d\d/)) {
			const fields = {
				date: '',
				transaction: '',
				type: '',
				name: '',
				account: '',
				ident: '',
				info: '',
				amount: '',
				fees: '',
			};

			const row = columns.map((col) => {
				return line.substr(col.start, col.length).trim()
			});

			fields.date = row[0];
			fields.type = row[1];
			fields.name = row[2];
			fields.ident = row[3];
			fields.amount = floatFromString(row[4]);
			fields.fees = floatFromString(row[5]);

			while (true) {
				i += 1;
				const nextLine = lines[i];
				const nextRow = columns.map((col) => {
					return nextLine.substr(col.start, col.length).trim()
				});
				const transaction = parseInt(nextRow[1]);
				fields.account += ' ' + nextRow[2];
				fields.info += ' ' + nextRow[3];
				if (isNaN(transaction)) {
					fields.type += ' ' + nextRow[1];
				}
				else {
					fields.transaction = transaction;
					break;
				}
			}

			fields.type = fields.type.trim();
			fields.account = fields.account.trim();
			fields.info = fields.info.trim();

			data.push([
				fields.date,
				fields.transaction,
				fields.type,
				fields.name,
				fields.account,
				fields.ident,
				fields.info,
				fields.amount,
				fields.fees,
			]);
		}

		i += 1;
	}

	return data;
}

async function appendTransactions(transactions) {
	const auth = new google.auth.GoogleAuth({
		keyFile: 'jwt.keys.json',
		scopes: 'https://www.googleapis.com/auth/spreadsheets',
	})

	const range = 'Trans!A:E'
	const sheets = google.sheets({version: 'v4'})
	const request = {
		spreadsheetId: process.env.SPREADSHEET_ID,
		range: range,
		valueInputOption: 'USER_ENTERED',
		insertDataOption: 'INSERT_ROWS',
		auth: auth,
		resource: {
			'range': range,
			'majorDimension': 'ROWS',
			'values': transactions,
		},
	};

	return new Promise((resolve, reject) => {
		sheets.spreadsheets.values.append(request, function(err, response) {
			if (err) {
				reject(err)
			}
			else {
				resolve(JSON.stringify(response.data, null, 2));
			}
		});
	})
}

function reply(mail, body) {
	let transporter = nodemailer.createTransport({
		host: 'smtp.gmail.com',
		auth: {
			user: process.env.GMAIL_USER,
			pass: process.env.GMAIL_PASSWORD,
		}
	})

	transporter.sendMail({
		to: mail.from,
		inReplyTo: mail.messageId,
		references: mail.messageId,
		subject: `Re: ${mail.subject}`,
		html: `<code style="white-space: pre-wrap;">${body}</code>`
	}, (error) => {
		if (error) {
			console.error(error)
			process.exit(1)
		}
	})
}
