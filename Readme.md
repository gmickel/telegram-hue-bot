#Node.js Telegram Bot for communicating with the Philips Hue Bridge and Lights

Bot which lets you or others control [Hue](http://www.meethue.com/) Lights via the messaging service [Telegram](https://telegram.org/).

## Screenshots
### Text Commands
![List Example](/screenshots/list-example.jpg?raw=true)
### Keyboard Control
![Step 1](/screenshots/step1.jpg?raw=true) ![Step 2](/screenshots/step2.jpg?raw=true)

![Step 3](/screenshots/step3.jpg?raw=true) ![Step 4](/screenshots/step4.jpg?raw=true)

## Changelog
- v1.0.0 - Initial release
- v2.0.0 - Add custom keyboard control
- v2.2.0 - General cleanup
- v2.3.0 - Can now set RGB values on entire groups

Getting Started
---------------

## Prerequisites
- [Node.js](http://nodejs.org) v4.2.x+
- A Telegram bot - see [here](<https://core.telegram.org/bots#botfather>) for instructions
- Contact [@BotFather](http://telegram.me/BotFather) on Telegram to create and get a bot token.

## Installation

```bash
# Clone the repository
git clone https://github.com/gmickel/telegram-hue-bot.git
```

```bash
# Install dependencies
cd telegram-hue-bot
npm install
```

```bash
# Copy config/acl.json.template to acl.json
cp config/acl.json.template acl.json
```

```bash
# Copy config/config.json.template to config.json
cp config/config.json.template config.json
```

In `config.json` fill in the values below:

Telegram:
- **botToken** your Telegram Bot token

Bot:
- **password** the password required to access the bot
- **owner** your Telegram user ID. (NYI)

Hue:
- **host**: The Hostname / IP of your Hue Bridge (optional)
- **user**: The user on the Hue Bridge to use to connect to the Hue Bridge (optional)
- **presets.colors**: The config file has some examples of color presets that can then be used to easily recall light and group states. (optional)

**Important note**: If the host and/or user is missing from the config file then the application will attempt to discover your bridge and create a user for you and save them in the config file. Remember that you need to press the link button on your Hue Bridge to allow the creation of a new user.

**Important note**: Restart the bot after making any changes to the `config.json` file.

```bash
# Start the bot
npm run start
```

## Usage

### First use
Authorize your telegram user with the bot by sending the `/auth` command with the password you created in `config.json`
Sending `/help` or `/h` to the bot will display a brief overview of the text commands and their usage.
Sending `/quick` or `/q` to the bot will display a pre-populated keyboard with some quick on/off commands for your Hue groups.

### Controlling your hue using the telegram keyboard
Sending `/hue` to the bot will display a telegram keyboard that allows you to manipulate your lights and groups using the displayed buttons.
Sending `/clear` clears all previously entered commands, this restarts the telegram keyboard command flow


### Controlling your hue using text commands

#### Listing lights, groups or scenes

Send the bot a message with the resource name

`/ls lights|groups|scenes` or `/list lights|groups|scenes`

#### Display a light or group's attributes

`/l <lightId>` or `/light <lightId>`

`/g <groupId>` or `/group <groupId>`

#### Light / Group manipulation

`/l|light [id] [command] <value>`

`/g|group [id] [command] <value>`

The following are valid commands:

`on | off` Turn a light or a group on or off

`preset <red>` Apply a preset from the config file to a light or group

`bri <0-255>` Set the brightness of a group or light

`sat <0-255>` Set the saturation of a group or light

`hue <0-65535>` Set the hue of a group or light

`rgb <255,255,255>` Set the colour using RGB of a group or light

The following command is only valid for groups:

`scene <sceneId>` Apply a scene to a group, use group 0 for the group defined in the scene or use another group to apply the scene to the defined group *and* the specified group


## License
(The MIT License)

Copyright (c) 2016 Gordon Mickel

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
