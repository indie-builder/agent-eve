import { eveChannel } from "eve/channels/eve";
import { createEveChannelAuth } from "../../src/trust-policy";

export default eveChannel({
  auth: createEveChannelAuth(),
});
