
(function(Scratch) {
    'use strict';

    // PeerJS kütüphanesini dışarıdan güvenli bir şekilde çekelim
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/peerjs@1.4.7/dist/peerjs.min.js';
    document.head.appendChild(script);

    // Global Değişkenler
    let peer = null;
    let connections = {};
    let lastDataFromPeers = {};
    let myID = "";
    
    // Olay Takipçileri
    let lastEventID = ""; // O an işlem yapan (katılan/çıkan) oyuncunun ID'si
    let lastEventData = ""; // Gelen son ham veri
    let joinTrigger = false;
    let leaveTrigger = false;
    let dataTrigger = false;

    // Gelişmiş Veri Deposu
    let stats = {
        can: {},
        takim: {},
        isim: {},
        skor: {}
    };

    class MegaP2PV12 {
        constructor(runtime) {
            this.runtime = runtime;
        }

        /**
         * Blok Tanımları
         */
        getInfo() {
            return {
                id: 'megap2pv12',
                name: 'Mega P2P V12 (Pro)',
                color1: '#16a085', // Güzel bir yeşil
                color2: '#1abc9c',
                blocks: [
                    "--- SİSTEM KURULUMU ---",
                    {
                        opcode: 'initSystem',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'P2P Motorunu Çalıştır'
                    },
                    {
                        opcode: 'setMyID',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'Kendi ID Kodumu [ID] Yap (6 Hane)',
                        arguments: { ID: { type: Scratch.ArgumentType.STRING, defaultValue: 'aga123' } }
                    },
                    {
                        opcode: 'getMyID',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'Kendi ID Kodum'
                    },
                    "--- BAĞLANTI İŞLEMLERİ ---",
                    {
                        opcode: 'connectToFriend',
                        blockType: Scratch.BlockType.COMMAND,
                        text: '[ID] Kodlu Oyuncuya Bağlan',
                        arguments: { ID: { type: Scratch.ArgumentType.STRING, defaultValue: '654321' } }
                    },
                    {
                        opcode: 'disconnectAll',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'Tüm Bağlantıları Kopar'
                    },
                    "--- ŞAPKA BLOKLARI (OTOMATİK) ---",
                    {
                        opcode: 'whenPlayerJoins',
                        blockType: Scratch.BlockType.HAT,
                        text: 'Yeni Oyuncu Katıldığında',
                        isEdgeActivated: false // SnailIDE hata vermesin diye
                    },
                    {
                        opcode: 'whenPlayerLeaves',
                        blockType: Scratch.BlockType.HAT,
                        text: 'Bir Oyuncu Ayrıldığında',
                        isEdgeActivated: false
                    },
                    {
                        opcode: 'whenDataArrives',
                        blockType: Scratch.BlockType.HAT,
                        text: 'Birinden Veri Geldiğinde',
                        isEdgeActivated: false
                    },
                    {
                        opcode: 'getEventID',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'Olaydaki Oyuncu ID'
                    },
                    "--- VERİ YÖNETİMİ ---",
                    {
                        opcode: 'broadcast',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'Herkese [DATA] Verisini Yay',
                        arguments: { DATA: { type: Scratch.ArgumentType.STRING, defaultValue: '100|200|ates' } }
                    },
                    {
                        opcode: 'getRaw',
                        blockType: Scratch.BlockType.REPORTER,
                        text: '[ID] Ham Verisi',
                        arguments: { ID: { type: Scratch.ArgumentType.STRING, defaultValue: 'id' } }
                    },
                    {
                        opcode: 'splitData',
                        blockType: Scratch.BlockType.REPORTER,
                        text: '[DATA] Paketinin [I]. Parçası (|)',
                        arguments: {
                            DATA: { type: Scratch.ArgumentType.STRING, defaultValue: '100|200|1' },
                            I: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 }
                        }
                    },
                    "--- OYUN MEKANİKLERİ ---",
                    {
                        opcode: 'distanceBetween',
                        blockType: Scratch.BlockType.REPORTER,
                        text: '[ID1] ve [ID2] Arasındaki Mesafe',
                        arguments: { ID1: { type: Scratch.ArgumentType.STRING, defaultValue: 'ben' }, ID2: { type: Scratch.ArgumentType.STRING, defaultValue: 'rakip' } }
                    },
                    {
                        opcode: 'setPlayerStat',
                        blockType: Scratch.BlockType.COMMAND,
                        text: '[ID] İçin [STAT] Değerini [VAL] Yap',
                        arguments: {
                            ID: { type: Scratch.ArgumentType.STRING, defaultValue: 'id' },
                            STAT: { type: Scratch.ArgumentType.STRING, menu: 'statMenu' },
                            VAL: { type: Scratch.ArgumentType.STRING, defaultValue: '100' }
                        }
                    },
                    {
                        opcode: 'getPlayerStat',
                        blockType: Scratch.BlockType.REPORTER,
                        text: '[ID] Oyuncusunun [STAT] Bilgisi',
                        arguments: {
                            ID: { type: Scratch.ArgumentType.STRING, defaultValue: 'id' },
                            STAT: { type: Scratch.ArgumentType.STRING, menu: 'statMenu' }
                        }
                    },
                    "--- DURUM VE LİSTE ---",
                    {
                        opcode: 'isOnline',
                        blockType: Scratch.BlockType.BOOLEAN,
                        text: '[ID] Çevrimiçi mi?',
                        arguments: { ID: { type: Scratch.ArgumentType.STRING, defaultValue: 'id' } }
                    },
                    {
                        opcode: 'onlineList',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'Tüm Oyuncuların ID Listesi'
                    },
                    {
                        opcode: 'playerCount',
                        blockType: Scratch.BlockType.REPORTER,
                        text: 'Toplam Oyuncu Sayısı'
                    }
                ],
                menus: {
                    statMenu: {
                        acceptReporters: true,
                        items: ['Can', 'Takım', 'Skor', 'İsim']
                    }
                }
            };
        }

        /**
         * MOTOR FONKSİYONLARI
         */
        
        initSystem() {
            if (peer) return;
            peer = new Peer(myID || undefined);
            
            peer.on('open', (id) => {
                myID = id;
                console.log("Bağlantı Hazır. ID'niz: " + id);
            });

            peer.on('connection', (conn) => {
                this.setupConnection(conn);
            });
        }

        setupConnection(conn) {
            conn.on('open', () => {
                connections[conn.peer] = conn;
                lastEventID = conn.peer;
                joinTrigger = true; // Katıldı şapkasını tetikle
            });

            conn.on('data', (data) => {
                lastDataFromPeers[conn.peer] = data;
                lastEventID = conn.peer;
                lastEventData = data;
                dataTrigger = true; // Veri geldi şapkasını tetikle
            });

            conn.on('close', () => {
                lastEventID = conn.peer;
                leaveTrigger = true; // Ayrıldı şapkasını tetikle
                delete connections[conn.peer];
            });

            conn.on('error', (err) => {
                console.error("Bağlantı hatası:", err);
            });
        }

        /**
         * ŞAPKA BLOK TETİKLEYİCİLERİ
         */
        
        whenPlayerJoins() {
            if (joinTrigger) {
                setTimeout(() => { joinTrigger = false; }, 50);
                return true;
            }
            return false;
        }

        whenPlayerLeaves() {
            if (leaveTrigger) {
                setTimeout(() => { leaveTrigger = false; }, 50);
                return true;
            }
            return false;
        }

        whenDataArrives() {
            if (dataTrigger) {
                setTimeout(() => { dataTrigger = false; }, 50);
                return true;
            }
            return false;
        }

        getEventID() {
            return lastEventID || "";
        }

        /**
         * KOMUTLAR VE DİĞERLERİ
         */

        setMyID(args) {
            myID = String(args.ID).substring(0, 6);
        }

        getMyID() {
            return myID || "Bağlanılmadı";
        }

        connectToFriend(args) {
            if (!peer) return;
            const conn = peer.connect(args.ID);
            this.setupConnection(conn);
        }

        disconnectAll() {
            for (let id in connections) {
                connections[id].close();
            }
            connections = {};
        }

        broadcast(args) {
            for (let id in connections) {
                if (connections[id].open) {
                    connections[id].send(args.DATA);
                }
            }
        }

        getRaw(args) {
            return lastDataFromPeers[args.ID] || "";
        }

        splitData(args) {
            const parts = String(args.DATA).split('|');
            return parts[args.I - 1] || "";
        }

        setPlayerStat(args) {
            const s = args.STAT.toLowerCase();
            if (!stats[s]) stats[s] = {};
            stats[s][args.ID] = args.VAL;
        }

        getPlayerStat(args) {
            const s = args.STAT.toLowerCase();
            return (stats[s] && stats[s][args.ID]) ? stats[s][args.ID] : "";
        }

        isOnline(args) {
            return !!connections[args.ID];
        }

        onlineList() {
            return Object.keys(connections).join(',');
        }

        playerCount() {
            return Object.keys(connections).length;
        }

        distanceBetween(args) {
            const d1 = (lastDataFromPeers[args.ID1] || "0|0").split('|');
            const d2 = (lastDataFromPeers[args.ID2] || "0|0").split('|');
            const x1 = parseFloat(d1[0]) || 0;
            const y1 = parseFloat(d1[1]) || 0;
            const x2 = parseFloat(d2[0]) || 0;
            const y2 = parseFloat(d2[1]) || 0;
            return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        }
    }

    // SnailIDE Kayıt
    Scratch.extensions.register(new MegaP2PV12(Scratch.vm.runtime));

})(Scratch);