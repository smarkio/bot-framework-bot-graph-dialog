import * as Debug from 'debug';

let infoLogger = Debug('botFramework:graphDialog:info');
let debugLogger = Debug('botFramework:graphDialog:debug');
let errorLogger = Debug('botFramework:graphDialog:error');

infoLogger.log = console.log.bind(console);
debugLogger.log = console.log.bind(console);

export {infoLogger as Log};
export {infoLogger as InfoLog};
export {debugLogger as DebugLog};
export {errorLogger as ErrorLog};
export default debugLogger;