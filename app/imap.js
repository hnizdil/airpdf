import {run} from "./shared.js"
import {ImapFlow} from 'imapflow'

const client = new ImapFlow({
	host: 'imap.gmail.com',
	port: 993,
	secure: true,
	logger: {},
	disableAutoIdle: true,
	auth: {
		user: process.env.GMAIL_USER,
		pass: process.env.GMAIL_PASSWORD,
	}
})

run(async function*() {
	await client.connect()

	let lock = await client.getMailboxLock('Air Bank/Výpisy')
	try {
		let unseen = await client.search({seen: false})
		for (let seq of unseen) {
			let downloaded = await client.download(seq)
			await client.messageFlagsSet(seq, ['\\Seen'])
			yield downloaded.content
		}
	}
	finally {
		lock.release()
	}

	await client.logout()
})
