Extracts transactions from Air Bank monthly e-mail and appends them to specified Google Sheet.

File `smtp.js` reads raw e-mail from `stdin`.

File `imap.js` fetches unread e-mails from Gmail IMAP.

# SMTP crontab

```
0 7 1,2 * * /home/belakos/bin/docker-compose-just-quieter --log-level ERROR --file /home/belakos/airpdf/docker-compose.yml run --rm imap
```

# Exim4

`dpkg-reconfigure exim4-config`

To pipe e-mails going to `belakos+airpdf` into script, see exim4 config files in `etc/` directory.

## Smarthost (relay) send, SMTP receive

```
# /etc/exim4/update-exim4.conf.conf
dc_eximconfig_configtype='smarthost'
dc_other_hostnames='agzilla.cz'
dc_local_interfaces=''
dc_readhost='mail.agzilla.cz'
dc_relay_domains=''
dc_minimaldns='false'
dc_relay_nets=''
dc_smarthost='smtp.gmail.com'
CFILEMODE='644'
dc_use_split_config='true'
dc_hide_mailname='false'
dc_mailname_in_oh='true'
dc_localdelivery='mail_spool'
```

## Plus Sub-Addressing
```
# Add following to /etc/exim4/conf.d/router/900_exim4-config_local_user
...
local_part_suffix = +*
local_part_suffix_optional
...
```
