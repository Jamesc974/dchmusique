const { Client } = require('discord.js');
const yt = require('ytdl-core');
const tokens = require('./tokens.json');
const ffmpeg = require('ffmpeg');
const request = require("request");
const client = new Client();
prefix = tokens.prefix;

let playlist = {};

const commands = {
	'play': (msg) => {
		if (playlist[msg.guild.id] === undefined) return msg.channel.sendMessage(`Ajoutez quelques chansons à la file d'attente d'abord avec ${tokens.prefix}add`);
		if (!msg.guild.voiceConnection) return commands.join(msg).then(() => commands.play(msg));
		if (playlist[msg.guild.id].playing) return msg.channel.sendMessage('❌Musique déjà joué❌');
		let dispatcher;
		playlist[msg.guild.id].playing = true;

		console.log(playlist);
		(function play(song) {
			console.log(song);
			if (song === undefined) return msg.channel.sendMessage('📂La file playlist est vide').then(() => {
				playlist[msg.guild.id].playing = false;
				msg.member.voiceChannel.leave();
			});
			msg.channel.sendMessage(":arrow_forward: Lecture de: "  + '`' + song.title + '`' + `:notes: Par: **${song.requester}**`);
			dispatcher = msg.guild.voiceConnection.playStream(yt(song.url, { audioonly: true }), { passes : tokens.passes });			let collector = msg.channel.createCollector(m => m);
			collector.on('message', m => {
				if (m.content.startsWith(tokens.prefix + 'pause')) {
					msg.channel.sendMessage(':pause_button: Musique mis sur **Pause**').then(() => {dispatcher.pause();});
				} else if (m.content.startsWith(tokens.prefix + 'resume')){
					msg.channel.sendMessage(':arrow_forward: Relancement de la musique').then(() => {dispatcher.resume();});
				} else if (m.content.startsWith(tokens.prefix + 'skip')){
					msg.channel.sendMessage(':fast_forward: Changement de musique').then(() => {dispatcher.end();});
				} else if (m.content.startsWith('volume+')){
					if (Math.round(dispatcher.volume*50) >= 100) return msg.channel.sendMessage(`Volume: ${Math.round(dispatcher.volume*50)}%`);
					dispatcher.setVolume(Math.min((dispatcher.volume*50 + (2*(m.content.split('+').length-1)))/50,2));
					msg.channel.sendMessage(`:loud_sound: Volume: ${Math.round(dispatcher.volume*50)}%`);
				} else if (m.content.startsWith('volume-')){
					if (Math.round(dispatcher.volume*50) <= 0) return msg.channel.sendMessage(`Volume: ${Math.round(dispatcher.volume*50)}%`);
					dispatcher.setVolume(Math.max((dispatcher.volume*50 - (2*(m.content.split('-').length-1)))/50,0));
					msg.channel.sendMessage(`:sound: Volume: ${Math.round(dispatcher.volume*50)}%`);
				} else if (m.content.startsWith(tokens.prefix + 'time')){
					msg.channel.sendMessage(`:clock1: time: ${Math.floor(dispatcher.time / 60000)}:${Math.floor((dispatcher.time % 60000)/1000) <10 ? '0'+Math.floor((dispatcher.time % 60000)/1000) : Math.floor((dispatcher.time % 60000)/1000)}`);
				}
			});
			dispatcher.on('end', () => {
				collector.stop();
				play(playlist[msg.guild.id].songs.shift());
			});
			dispatcher.on('error', (err) => {
				return msg.channel.sendMessage('error: ' + err).then(() => {
					collector.stop();
					play(playlist[msg.guild.id].songs.shift());
				});
			});
		})(playlist[msg.guild.id].songs.shift());
	},
	'join': (msg) => {
		return new Promise((resolve, reject) => {
			const voiceChannel = msg.member.voiceChannel;
			if (!voiceChannel || voiceChannel.type !== 'voice') return msg.reply(':disappointed_relieved: Je ne peux pas me connecter à votre Channel');
			voiceChannel.join().then(connection => resolve(connection)).catch(err => reject(err));
		});
	},
	'add': (msg) => {
		let url = msg.content.split(' ')[1];
		if (url == '' || url === undefined) return msg.channel.sendMessage(`Vous devez ajouter une vidéo YouTube ou id faite ${tokens.prefix}add`);
		yt.getInfo(url, (err, info) => {
			if(err) return msg.channel.sendMessage(':x: Lien Youtube Invalide: ' + err);
			msg.channel.sendMessage(":film_frames: **Recherche** :mag_right: " + '`'+ url +'`')
			if (!playlist.hasOwnProperty(msg.guild.id)) playlist[msg.guild.id] = {}, playlist[msg.guild.id].playing = false, playlist[msg.guild.id].songs = [];
			playlist[msg.guild.id].songs.push({url: url, title: info.title, requester: msg.author.username});
			msg.channel.sendMessage(`:white_check_mark: Ajout de **${info.title}** à la playlist`);
		});
	},
	'playlist': (msg) => {
		if (playlist[msg.guild.id] === undefined) return msg.channel.sendMessage(`:white_check_mark: Ajoutez quelques chansons à la file d'attente d'abord avec ${tokens.prefix}add`);
		let tosend = [];
		playlist[msg.guild.id].songs.forEach((song, i) => { tosend.push(`${i+1}. ${song.title} - Par: ${song.requester}`);});
		msg.channel.sendMessage(`:repeat: __**${msg.guild.name} Playlist :**__ Actuellement **${tosend.length}** Musique juste aprés ${(tosend.length > 15 ? '*[Seulement ensuite 15 montré]*' : '')}\n\`\`\`${tosend.slice(0,15).join('\n')}\`\`\``);
	},
	'dchbot': (msg) => {
		let tosend = ['```xl', tokens.prefix + 'join : "Pour qu\'il join votre channel"',	tokens.prefix + 'add : "Ajoutez un lien youtube valable à la PlayList"', tokens.prefix + 'playlist : "Montre la file playlist, jusqu\'à 15 chansons montrées."', tokens.prefix + 'play : "Jouez la playList (ATTENTION le bot doit etre dans le channel)"', '', 'Les commandes suivantes fonctionnent seulement si le bot fonctionne :'.toUpperCase(), tokens.prefix + 'pause : "Mettre en pause la musique / arrêter la musique"',	tokens.prefix + 'resume : "Reprend la musique"', tokens.prefix + 'skip : "Changer de Musique"', tokens.prefix + 'time : "Montre la temps de la chanson."',	'volume+(+++) : "Augmente le volume à 2%/+"',	'volume-(---) : "Baisser le volume à 2%/-"',	'```'];
		msg.channel.sendMessage(tosend.join('\n'));
	},
	'reboot': (msg) => {
		if (msg.author.id == tokens.adminID) process.exit(); //Requires a node module like Forever to work.
	}
};

client.on("ready", () => {
  console.log(`${client.user.username} est en ligne sur ${client.guilds.size} serveurs!`);
  client.user.setPresence({ game: { name: `!dchbot | connecté à ${client.guilds.size} serveurs | by DCH`}})

});

client.on('ready', () => {
	console.log('Bot Musique Prés pour utilisation');
});

client.on('message', msg => {
	if (!msg.content.startsWith(tokens.prefix)) return;
	if (commands.hasOwnProperty(msg.content.toLowerCase().slice(tokens.prefix.length).split(' ')[0])) commands[msg.content.toLowerCase().slice(tokens.prefix.length).split(' ')[0]](msg);
});
client.login(process.env.TOKEN);
