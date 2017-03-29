## Install

0. Make sure you have installed the **node.js**
1. Download or clone this repository to local
2. Move file **index.php** into your public dirctory (e.g. /var/www/html)
3. `cd auto_moderator` and run `npm install`
4. `sudo chown -R yourname:www-data /var/www/html`
5. `sudo chmod -R g+s /var/www/html`

## Usage

1. Goto **youripaddress:80/index.php**
2. Press **Start** button, then you should see a successful starup response
3. Use one device as the audio server, goto **youripaddress:8010** and select **Server**. Then you can setup the number of players and different identities
4. For players, go to **youripaddress:8010** and select **Player**. Then you should be automatically assigned with an identity. 
5. Wait untill all players are online, then enjoy the game of Werewolf as you usually do with the robot moderator that never make any mistakes~
6. After one round of game, click **stop** in **index.php**. You may press **start** again to startup a new round of game. 