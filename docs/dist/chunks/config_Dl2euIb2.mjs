const astroConfig = {"base":"/vibecode-webgui/","root":"file:///Users/ryan.maclean/vibecode-webgui/docs/","srcDir":"file:///Users/ryan.maclean/vibecode-webgui/docs/src/","build":{"assets":"_astro"},"markdown":{"shikiConfig":{"langs":[]}}};
const ecIntegrationOptions = {};
let ecConfigFileOptions = {};
try {
	ecConfigFileOptions = (await import('./ec-config_CzTTOeiV.mjs')).default;
} catch (e) {
	console.error('*** Failed to load Expressive Code config file "file:///Users/ryan.maclean/vibecode-webgui/docs/ec.config.mjs". You can ignore this message if you just renamed/removed the file.\n\n(Full error message: "' + (e?.message || e) + '")\n');
}

export { astroConfig, ecConfigFileOptions, ecIntegrationOptions };
