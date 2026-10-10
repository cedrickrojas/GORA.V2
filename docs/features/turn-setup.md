# TURN setup para sa GORA calls at Go Live

Gumagana na ang voice/video call UI at signaling. Para sa mga network na hindi pumapayag sa direct connection, kailangan ng TURN relay. Ang setup na ito ay para sa **hiwalay na Linux VPS na may public IPv4 at Docker Engine**. Walang relay server na awtomatikong nagagawa kapag nag-push sa GitHub o nag-redeploy sa Vercel.

Ginagamit ng GORA ang coturn **TURN REST shared-secret authentication**. Gumagawa ang API ng credentials na may 24-hour expiry para sa signed-in user. Hindi tugma ang provider na static username/password lang ang ibinibigay nang walang pagbabago sa API.

## 1. Ihanda ang VPS at domain

- Gumamit ng dedicated Linux VPS na may public IPv4, SSH access, at Docker Engine. May hiwalay itong hosting/bandwidth cost.
- Gumawa ng DNS **A record**, halimbawa `turn.example.com`, papunta sa VPS public IPv4. Palitan ang example domain sa lahat ng susunod na steps. Dapat direct DNS ito, walang HTTP/CDN proxy.
- Sa VPS at provider firewall, payagan ang inbound **3478 TCP/UDP**, **443 TCP** para sa TURN over TLS, at **49160–49359 UDP** para sa relay media. Kailangan din ng outbound traffic sa mga peer. Panatilihin ang SSH access.
- Para sa certificate command sa step 4, payagan din ang inbound **80 TCP**. Dapat walang ibang service na gumagamit ng ports 80/443 sa VPS na ito.
- Kung naka-NAT ang VPS, kailangan ang public-to-private mapping na pareho ang port numbers, kasama ang buong relay range.

## 2. Gumawa ng bagong TURN secret

Sa sarili mong PowerShell terminal:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Itago ang output sa password manager. Ito ang gagamitin sa `static-auth-secret` ng coturn at sa `LIVE_TURN_SECRET` ng Vercel. Gumamit ng bagong secret na hiwalay sa `JWT_SECRET`; huwag ilagay sa GitHub o i-paste sa chat.

## 3. Coturn configuration sa VPS

Ang mga `bash` command sa guide ay sa **Linux VPS terminal**, hindi sa Windows PowerShell. Naka-install na dapat ang Docker Engine.

```bash
sudo install -d -o root -g 65534 -m 750 /opt/gora-turn
sudo nano /opt/gora-turn/turnserver.conf
```

Ilagay ito sa config, at palitan ang tatlong `REPLACE_...` values:

```ini
listening-port=3478
listening-ip=0.0.0.0
relay-ip=REPLACE_WITH_VPS_INTERFACE_IPV4
external-ip=REPLACE_WITH_VPS_PUBLIC_IPV4
realm=turn.example.com
fingerprint
use-auth-secret
static-auth-secret=REPLACE_WITH_NEW_TURN_SECRET
min-port=49160
max-port=49359
user-quota=12
total-quota=100
no-multicast-peers
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=::1
denied-peer-ip=fc00::-fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff
denied-peer-ip=fe80::-febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff
no-tcp-relay
no-tls
no-dtls
log-file=stdout
```

`VPS_INTERFACE_IPV4` ay IP na nakalagay sa network interface (`ip -4 addr`); maaaring private IP ito sa VPS na naka-NAT. `VPS_PUBLIC_IPV4` ang public IP mula sa hosting dashboard. Ang `no-tcp-relay` ay hindi nagdi-disable ng TCP client connection sa 3478; UDP relay media ang ginagamit dito. Huwag idagdag ang `no-auth`, `allow-loopback-peers`, o static `user=` accounts.

```bash
sudo chown root:65534 /opt/gora-turn/turnserver.conf
sudo chmod 640 /opt/gora-turn/turnserver.conf
sudo docker run -d --name gora-turn --restart unless-stopped \
  --network host \
  --mount type=bind,source=/opt/gora-turn,target=/etc/coturn,readonly \
  --log-opt max-size=10m --log-opt max-file=3 \
  coturn/coturn:4.18.0-r0 -c /etc/coturn/turnserver.conf
sudo docker logs --tail 50 gora-turn
```

Ang pinned Debian image ay gumagamit ng user/group `65534`, kaya iyon ang group permissions sa files. Gumagamit ito ng Linux host networking; walang Docker `-p` mapping. Kung hindi lumalabas ang relay, suriin ang IP mapping at parehong firewalls. I-monitor ang bandwidth at allocations; panimulang capacity lang ang quota/range na ito.

## 4. Dagdagan ng TLS sa port 443

Makakatulong ito sa networks na nagba-block ng UDP/3478. Hindi pa rin garantisado ang calls sa bawat restricted network. Sa Ubuntu/Debian VPS na may tamang DNS at bukas na port 80:

```bash
sudo apt-get update
sudo apt-get install -y certbot
sudo certbot certonly --standalone -d turn.example.com
sudo install -o root -g 65534 -m 640 \
  /etc/letsencrypt/live/turn.example.com/fullchain.pem /opt/gora-turn/fullchain.pem
sudo install -o root -g 65534 -m 640 \
  /etc/letsencrypt/live/turn.example.com/privkey.pem /opt/gora-turn/privkey.pem
sudo nano /opt/gora-turn/turnserver.conf
```

Alisin ang `no-tls` line, panatilihin ang `no-dtls`, at idagdag:

```ini
tls-listening-port=443
cert=/etc/coturn/fullchain.pem
pkey=/etc/coturn/privkey.pem
```

```bash
sudo docker restart gora-turn
openssl s_client -connect turn.example.com:443 -servername turn.example.com \
  -verify_hostname turn.example.com -verify_return_error </dev/null
```

Dapat valid ang certificate chain at tugma sa domain. Para makopya ang bagong certificate pagkatapos ng automatic renewal, gumawa ng `/etc/letsencrypt/renewal-hooks/deploy/gora-turn.sh` gamit ang `sudo nano`, na may laman:

```sh
#!/bin/sh
set -eu
if [ "$RENEWED_LINEAGE" = "/etc/letsencrypt/live/turn.example.com" ]; then
  install -o root -g 65534 -m 640 "$RENEWED_LINEAGE/fullchain.pem" /opt/gora-turn/fullchain.pem
  install -o root -g 65534 -m 640 "$RENEWED_LINEAGE/privkey.pem" /opt/gora-turn/privkey.pem
  docker restart gora-turn
fi
```

```bash
sudo chmod 700 /etc/letsencrypt/renewal-hooks/deploy/gora-turn.sh
sudo certbot renew --dry-run
systemctl list-timers --all | grep certbot
```

Panatilihing available ang port 80 para sa standalone renewal at aktibo ang renewal timer. Ang restart ng relay ay makakaputol ng active relayed calls, kaya planuhin ang maintenance. I-update rin ang pinned coturn image kapag may security fixes.

## 5. Ilagay sa Vercel at redeploy

Sa **gora.v2 → Settings → Environment Variables**, piliin ang **Production** at idagdag ang dalawang variables:

| Key | Value |
| --- | --- |
| `LIVE_TURN_URLS` | `turn:turn.example.com:3478?transport=udp,turn:turn.example.com:3478?transport=tcp,turns:turn.example.com:443?transport=tcp` |
| `LIVE_TURN_SECRET` | Eksaktong secret na ginamit sa `static-auth-secret`; piliing **Secret** ang type. |

Palitan muna ang domain ng totoong running relay. Kung step 3 pa lang ang nagawa, gamitin muna ang dalawang `turn:` URLs at idagdag lang ang `turns:` pagkatapos gumana ang TLS. Walang quotes o line breaks sa values. Optional ang `LIVE_STUN_URLS`; puwedeng panatilihin ang default.

Gawin ding available ang variables sa Preview kung doon magte-test. Para sa local API, puwedeng idagdag sa ignored `server/.env`. Ang production variables ay binabasa ng **server** service sa runtime; huwag gawing `VITE_*`. Pagkatapos mag-save, **Redeploy**, hintaying **Ready**, at i-reload ang app. Walang database migration para sa TURN setup.

## 6. I-test ang relay at actual calls

Mag-login sa GORA sa desktop browser. Buksan ang DevTools → Console sa mismong GORA tab at patakbuhin ang snippet na ito. Gumagamit ito ng kasalukuyang login at hindi nagpi-print ng tokens o TURN credentials. Isang allocation test lang ito; hindi ito tumatawag sa ibang user.

```js
await (async () => {
  const response = await fetch('/api/v1/live/config', {
    headers: { Authorization: `Bearer ${localStorage.getItem('gora.accessToken')}` },
  });
  if (!response.ok) throw new Error(`Config request failed: ${response.status}`);
  const { iceServers } = await response.json();
  const servers = iceServers.flatMap(server =>
    [server.urls].flat().filter(url => /^turns?:/.test(url))
      .map(url => ({ ...server, urls: url })),
  );
  if (!servers.length) throw new Error('Walang TURN config; check variables/redeploy.');
  for (const server of servers) {
    const pc = new RTCPeerConnection({ iceServers: [server], iceTransportPolicy: 'relay' });
    let timer;
    try {
      const allocated = new Promise(resolve => {
        timer = setTimeout(() => resolve(false), 15000);
        pc.onicecandidate = ({ candidate }) => {
          if (candidate?.type === 'relay') resolve(true);
          else if (!candidate) resolve(false);
        };
      });
      pc.createDataChannel('relay-check');
      await pc.setLocalDescription(await pc.createOffer());
      console.log(server.urls, await allocated ? 'RELAY OK' : 'NO RELAY');
    } finally {
      clearTimeout(timer);
      pc.close();
    }
  }
})();
```

Pagkatapos, gumamit ng **dalawang accounts at devices**: isa sa Wi-Fi at isa sa mobile data. Subukan ang voice call, video call, mute, camera on/off, at hang-up. Parehong bukas dapat ang app. Sa `chrome://webrtc-internals`, makikita ang selected candidate pair; `relay` ang candidate type kapag dumadaan sa TURN. Posible pa ring `host`/`srflx` kung mas mahusay ang direct route.

Kung `NO RELAY`: tingnan ang Vercel variables, hostname/IP, ports, TLS certificate, coturn logs, exact secret match, at server clock (`timedatectl status`). Kung `RELAY OK` pero walang actual audio/video, suriin ang relay UDP range, outbound firewall, permissions, at selected candidate pair. Iba ang allocation test sa matagumpay na media transfer sa magkabilang device.

Setup instructions lang ito; hindi pa na-provision o na-test ang sariling TURN host ninyo. Ang automated app checks ay gumamit ng simulated microphone/camera. Kailangan pa ang physical-device test pagkatapos ma-configure ang relay.

References: [coturn Docker setup](https://github.com/coturn/coturn/blob/master/docker/coturn/README.md), [coturn configuration](https://github.com/coturn/coturn/blob/master/docker/coturn/turnserver.conf), [coturn image user](https://github.com/coturn/coturn/blob/master/docker/coturn/debian/Dockerfile), [Certbot renewal hooks](https://eff-certbot.readthedocs.io/en/stable/using.html#renewing-certificates), [WebRTC TURN overview](https://webrtc.org/getting-started/turn-server).
