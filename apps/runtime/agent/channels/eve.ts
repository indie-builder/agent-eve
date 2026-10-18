import { eveChannel } from "eve/channels/eve";
import { createEveChannelAuth } from "../../src/security/channel-auth";

export default eveChannel({
  auth: createEveChannelAuth(),
});
