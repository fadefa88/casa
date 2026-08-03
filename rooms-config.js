window.CASA_ROOMS = [
  {
    id:'first-salotto', modelKey:'first__LivingDiningRoom-116276', floor:'first', name:'Salotto', icon:'fa-couch', type:'indoor', aliases:['salotto','soggiorno','living'],
    entities:{temperature:'sensor.salotto_temperatura',humidity:'sensor.salotto_umidita',lights:'light.salotto',cover:'cover.salotto',climate:'climate.clima_salotto'},
    candidates:{temperature:['sensor.termostato_salotto_temperatura','sensor.clima_soggiorno_temperatura','sensor.soggiorno_temperatura'],humidity:['sensor.soggiorno_umidita'],lights:['light.luce_salotto','light.luci_salotto','light.soggiorno'],cover:['cover.tapparella_salotto','cover.soggiorno'],climate:['climate.salotto','climate.termostato_salotto','climate.clima_soggiorno','climate.soggiorno']}
  },
  {
    id:'first-cucina', modelKey:null, floor:'first', name:'Cucina', icon:'fa-kitchen-set', type:'indoor', aliases:['cucina','kitchen'],
    entities:{temperature:'sensor.cucina_temperatura',humidity:'sensor.cucina_umidita',lights:'light.cucina',cover:'cover.cucina',climate:'climate.clima_cucina'},
    candidates:{temperature:['sensor.termostato_cucina_temperatura'],lights:['light.luce_cucina','light.luci_cucina'],cover:['cover.tapparella_cucina'],climate:['climate.cucina','climate.termostato_cucina']}
  },
  {
    id:'first-camera-matrimoniale', modelKey:'first__MasterBedroom-105249', floor:'first', name:'Camera Matrimoniale', icon:'fa-bed', type:'indoor', aliases:['camera matrimoniale','matrimoniale'],
    entities:{temperature:'sensor.camera_matrimoniale_temperatura',humidity:'sensor.camera_matrimoniale_umidita',lights:'light.camera_matrimoniale',cover:'cover.camera_matrimoniale',climate:'climate.clima_camera_matrimoniale'},
    candidates:{temperature:['sensor.termostato_camera_matrimoniale_temperatura'],lights:['light.luce_camera_matrimoniale'],cover:['cover.tapparella_camera_matrimoniale'],climate:['climate.camera_matrimoniale','climate.termostato_camera_matrimoniale']}
  },
  {
    id:'first-studio', modelKey:'first__Bedroom-106328', floor:'first', name:'Studio', icon:'fa-laptop', type:'indoor', aliases:['studio','ufficio','office'],
    entities:{temperature:'sensor.studio_temperatura',humidity:'sensor.studio_umidita',lights:'light.studio',cover:'cover.studio',climate:'climate.clima_studio'},
    candidates:{temperature:['sensor.termostato_studio_temperatura'],lights:['light.luce_studio','light.luci_studio'],cover:['cover.tapparella_studio'],climate:['climate.studio','climate.termostato_studio']}
  },
  {
    id:'first-cameretta', modelKey:'first__OtherRoom-109066', floor:'first', name:'Cameretta', icon:'fa-child', type:'indoor', aliases:['cameretta','camera bambino','camera bimbo'],
    entities:{temperature:'sensor.cameretta_temperatura',humidity:'sensor.cameretta_umidita',lights:'light.cameretta',cover:'cover.cameretta',climate:'climate.clima_cameretta'},
    candidates:{temperature:['sensor.camera_bambino_temperatura','sensor.termostato_cameretta_temperatura'],humidity:['sensor.camera_bambino_umidita'],lights:['light.luce_cameretta','light.camera_bambino'],cover:['cover.tapparella_cameretta','cover.camera_bambino'],climate:['climate.cameretta','climate.camera_bambino','climate.clima_camera_bambino']}
  },
  {
    id:'first-bagno-matrimoniale', modelKey:'first__MasterBathroom-92592', floor:'first', name:'Bagno Matrimoniale', icon:'fa-bath', type:'indoor', aliases:['bagno matrimoniale','bagno padronale'],
    entities:{temperature:'sensor.bagno_matrimoniale_temperatura',humidity:'sensor.bagno_matrimoniale_umidita',lights:'light.bagno_matrimoniale',cover:'cover.bagno_matrimoniale',climate:'climate.clima_bagno_matrimoniale'},
    candidates:{temperature:['sensor.bagno_padronale_temperatura'],humidity:['sensor.bagno_padronale_umidita'],lights:['light.luce_bagno_matrimoniale','light.bagno_padronale'],cover:['cover.tapparella_bagno_matrimoniale','cover.bagno_padronale'],climate:['climate.bagno_matrimoniale','climate.bagno_padronale','climate.clima_bagno_padronale']}
  },
  {
    id:'first-bagno-ospiti', modelKey:'first__Bathroom-109096', floor:'first', name:'Bagno Ospiti', icon:'fa-bath', type:'indoor', aliases:['bagno ospiti','bagno'],
    entities:{temperature:'sensor.bagno_ospiti_temperatura',humidity:'sensor.bagno_ospiti_umidita',lights:'light.bagno_ospiti',cover:'cover.bagno_ospiti',climate:'climate.clima_bagno_ospiti'},
    candidates:{temperature:['sensor.bagno_temperatura'],humidity:['sensor.bagno_umidita'],lights:['light.luce_bagno_ospiti','light.bagno'],cover:['cover.tapparella_bagno_ospiti','cover.bagno'],climate:['climate.bagno_ospiti','climate.bagno','climate.clima_bagno']}
  },
  {
    id:'first-corridoio', modelKey:'first__Corridor-117360', floor:'first', name:'Corridoio', icon:'fa-arrows-left-right', type:'indoor', aliases:['corridoio','disimpegno'],
    entities:{temperature:'sensor.corridoio_temperatura',humidity:'sensor.corridoio_umidita',lights:'light.corridoio',climate:'climate.clima_corridoio'},
    candidates:{temperature:['sensor.termostato_corridoio_temperatura'],lights:['light.luce_corridoio','light.luci_corridoio'],climate:['climate.corridoio','climate.termostato_corridoio']}
  },
  {
    id:'second-vano-tecnico', modelKey:'second__EquipmentRoom-36717', floor:'second', name:'Vano Tecnico', icon:'fa-screwdriver-wrench', type:'indoor', aliases:['vano tecnico','locale tecnico'],
    entities:{temperature:'sensor.vano_tecnico_temperatura',humidity:'sensor.vano_tecnico_umidita',lights:'light.vano_tecnico',climate:'climate.clima_vano_tecnico'},
    candidates:{temperature:['sensor.locale_tecnico_temperatura'],humidity:['sensor.locale_tecnico_umidita'],lights:['light.luce_vano_tecnico','light.locale_tecnico'],climate:['climate.vano_tecnico','climate.locale_tecnico','climate.clima_locale_tecnico']}
  },
  {
    id:'second-bagno-mansarda', modelKey:'second__Bathroom-37895', floor:'second', name:'Bagno Mansarda', icon:'fa-bath', type:'indoor', aliases:['bagno mansarda'],
    entities:{temperature:'sensor.bagno_mansarda_temperatura',humidity:'sensor.bagno_mansarda_umidita',lights:'light.bagno_mansarda',cover:'cover.bagno_mansarda',climate:'climate.clima_bagno_mansarda'},
    candidates:{lights:['light.luce_bagno_mansarda'],cover:['cover.tapparella_bagno_mansarda'],climate:['climate.bagno_mansarda','climate.termostato_bagno_mansarda']}
  },
  {
    id:'second-mansarda', modelKey:'second__LivingRoom-39392', floor:'second', name:'Mansarda', icon:'fa-couch', type:'indoor', aliases:['mansarda','soggiorno mansarda','salotto mansarda'],
    entities:{temperature:'sensor.mansarda_temperatura',humidity:'sensor.mansarda_umidita',lights:'light.mansarda',cover:'cover.mansarda',climate:'climate.clima_mansarda'},
    candidates:{temperature:['sensor.soggiorno_mansarda_temperatura'],humidity:['sensor.soggiorno_mansarda_umidita'],lights:['light.luce_mansarda','light.soggiorno_mansarda'],cover:['cover.tapparella_mansarda','cover.soggiorno_mansarda'],climate:['climate.mansarda','climate.soggiorno_mansarda','climate.clima_soggiorno_mansarda']}
  },
  {
    id:'second-camera-mansarda', modelKey:'second__Bedroom-35912', floor:'second', name:'Camera Mansarda', icon:'fa-bed', type:'indoor', aliases:['camera mansarda'],
    entities:{temperature:'sensor.camera_mansarda_temperatura',humidity:'sensor.camera_mansarda_umidita',lights:'light.camera_mansarda',cover:'cover.camera_mansarda',climate:'climate.clima_camera_mansarda'},
    candidates:{lights:['light.luce_camera_mansarda'],cover:['cover.tapparella_camera_mansarda'],climate:['climate.camera_mansarda','climate.termostato_camera_mansarda']}
  }
];
