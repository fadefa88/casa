window.CASA_ROOMS = [
  {
    id:'first-living', modelKey:'first__LivingDiningRoom-116276', floor:'first', name:'Soggiorno e cucina', icon:'fa-couch', type:'indoor', aliases:['soggiorno','salotto','living','cucina'],
    entities:{temperature:'sensor.soggiorno_temperatura',humidity:'sensor.soggiorno_umidita',lights:'light.soggiorno',cover:'cover.soggiorno',climate:'climate.clima_soggiorno'},
    candidates:{temperature:['sensor.termostato_salotto_temperatura','sensor.clima_soggiorno_temperatura'],lights:['light.luce_soggiorno','light.luci_soggiorno'],cover:['cover.tapparella_soggiorno'],climate:['climate.soggiorno','climate.termostato_salotto']}
  },
  {
    id:'first-master-bedroom', modelKey:'first__MasterBedroom-105249', floor:'first', name:'Camera matrimoniale', icon:'fa-bed', type:'indoor', aliases:['camera matrimoniale','matrimoniale'],
    entities:{temperature:'sensor.camera_matrimoniale_temperatura',humidity:'sensor.camera_matrimoniale_umidita',lights:'light.camera_matrimoniale',cover:'cover.camera_matrimoniale',climate:'climate.clima_camera_matrimoniale'},
    candidates:{lights:['light.luce_camera_matrimoniale'],cover:['cover.tapparella_camera_matrimoniale'],climate:['climate.camera_matrimoniale','climate.termostato_camera_matrimoniale']}
  },
  {
    id:'first-bedroom', modelKey:'first__Bedroom-106328', floor:'first', name:'Camera', icon:'fa-bed', type:'indoor', aliases:['camera ospiti','camera'],
    entities:{temperature:'sensor.camera_temperatura',humidity:'sensor.camera_umidita',lights:'light.camera',cover:'cover.camera',climate:'climate.clima_camera'},
    candidates:{lights:['light.luce_camera'],cover:['cover.tapparella_camera'],climate:['climate.camera','climate.termostato_camera']}
  },
  {
    id:'first-master-bathroom', modelKey:'first__MasterBathroom-92592', floor:'first', name:'Bagno padronale', icon:'fa-bath', type:'indoor', aliases:['bagno padronale'],
    entities:{temperature:'sensor.bagno_padronale_temperatura',humidity:'sensor.bagno_padronale_umidita',lights:'light.bagno_padronale',cover:'cover.bagno_padronale',climate:'climate.clima_bagno_padronale'},
    candidates:{lights:['light.luce_bagno_padronale'],cover:['cover.tapparella_bagno_padronale'],climate:['climate.bagno_padronale','climate.termostato_bagno_padronale']}
  },
  {
    id:'first-bathroom', modelKey:'first__Bathroom-109096', floor:'first', name:'Bagno', icon:'fa-bath', type:'indoor', aliases:['bagno primo piano','bagno'],
    entities:{temperature:'sensor.bagno_temperatura',humidity:'sensor.bagno_umidita',lights:'light.bagno',cover:'cover.bagno',climate:'climate.clima_bagno'},
    candidates:{lights:['light.luce_bagno'],cover:['cover.tapparella_bagno'],climate:['climate.bagno','climate.termostato_bagno']}
  },
  {
    id:'first-corridor', modelKey:'first__Corridor-117360', floor:'first', name:'Corridoio', icon:'fa-arrows-left-right', type:'indoor', aliases:['corridoio','disimpegno'],
    entities:{temperature:'sensor.corridoio_temperatura',humidity:'sensor.corridoio_umidita',lights:'light.corridoio',climate:'climate.clima_corridoio'},
    candidates:{lights:['light.luce_corridoio'],climate:['climate.corridoio','climate.termostato_corridoio']}
  },
  {
    id:'first-other-room', modelKey:'first__OtherRoom-109066', floor:'first', name:'Camera bambino', icon:'fa-child', type:'indoor', aliases:['camera bambino','cameretta'],
    entities:{temperature:'sensor.camera_bambino_temperatura',humidity:'sensor.camera_bambino_umidita',lights:'light.camera_bambino',cover:'cover.camera_bambino',climate:'climate.clima_camera_bambino'},
    candidates:{lights:['light.luce_camera_bambino','light.luce_cameretta'],cover:['cover.tapparella_camera_bambino','cover.tapparella_cameretta'],climate:['climate.camera_bambino','climate.cameretta']}
  },
  {
    id:'first-terrace-main', modelKey:'first__Terrace-101880', floor:'first', name:'Terrazza principale', icon:'fa-umbrella-beach', type:'outdoor', aliases:['terrazza principale','terrazza'],
    entities:{temperature:'sensor.terrazza_principale_temperatura',lights:'light.terrazza_principale',cover:'cover.terrazza_principale'},
    candidates:{lights:['light.luce_terrazza_principale'],cover:['cover.tenda_terrazza_principale']}
  },
  {
    id:'first-terrace-secondary', modelKey:'first__Terrace-119118', floor:'first', name:'Terrazza secondaria', icon:'fa-umbrella-beach', type:'outdoor', aliases:['terrazza secondaria'],
    entities:{temperature:'sensor.terrazza_secondaria_temperatura',lights:'light.terrazza_secondaria'},
    candidates:{lights:['light.luce_terrazza_secondaria']}
  },
  {
    id:'second-living', modelKey:'second__LivingRoom-39392', floor:'second', name:'Soggiorno mansarda', icon:'fa-couch', type:'indoor', aliases:['soggiorno mansarda','salotto mansarda'],
    entities:{temperature:'sensor.soggiorno_mansarda_temperatura',humidity:'sensor.soggiorno_mansarda_umidita',lights:'light.soggiorno_mansarda',cover:'cover.soggiorno_mansarda',climate:'climate.clima_soggiorno_mansarda'},
    candidates:{lights:['light.luce_soggiorno_mansarda'],cover:['cover.tapparella_soggiorno_mansarda'],climate:['climate.soggiorno_mansarda','climate.termostato_soggiorno_mansarda']}
  },
  {
    id:'second-bedroom', modelKey:'second__Bedroom-35912', floor:'second', name:'Camera mansarda', icon:'fa-bed', type:'indoor', aliases:['camera mansarda'],
    entities:{temperature:'sensor.camera_mansarda_temperatura',humidity:'sensor.camera_mansarda_umidita',lights:'light.camera_mansarda',cover:'cover.camera_mansarda',climate:'climate.clima_camera_mansarda'},
    candidates:{lights:['light.luce_camera_mansarda'],cover:['cover.tapparella_camera_mansarda'],climate:['climate.camera_mansarda','climate.termostato_camera_mansarda']}
  },
  {
    id:'second-bathroom', modelKey:'second__Bathroom-37895', floor:'second', name:'Bagno mansarda', icon:'fa-bath', type:'indoor', aliases:['bagno mansarda'],
    entities:{temperature:'sensor.bagno_mansarda_temperatura',humidity:'sensor.bagno_mansarda_umidita',lights:'light.bagno_mansarda',cover:'cover.bagno_mansarda',climate:'climate.clima_bagno_mansarda'},
    candidates:{lights:['light.luce_bagno_mansarda'],cover:['cover.tapparella_bagno_mansarda'],climate:['climate.bagno_mansarda','climate.termostato_bagno_mansarda']}
  },
  {
    id:'second-equipment', modelKey:'second__EquipmentRoom-36717', floor:'second', name:'Locale tecnico', icon:'fa-screwdriver-wrench', type:'indoor', aliases:['locale tecnico'],
    entities:{temperature:'sensor.locale_tecnico_temperatura',humidity:'sensor.locale_tecnico_umidita',lights:'light.locale_tecnico',climate:'climate.clima_locale_tecnico'},
    candidates:{lights:['light.luce_locale_tecnico'],climate:['climate.locale_tecnico','climate.termostato_locale_tecnico']}
  },
  {
    id:'second-terrace-main', modelKey:'second__Terrace-40381', floor:'second', name:'Terrazza mansarda', icon:'fa-umbrella-beach', type:'outdoor', aliases:['terrazza mansarda'],
    entities:{temperature:'sensor.terrazza_mansarda_temperatura',lights:'light.terrazza_mansarda',cover:'cover.terrazza_mansarda'},
    candidates:{lights:['light.luce_terrazza_mansarda'],cover:['cover.tenda_terrazza_mansarda']}
  },
  {
    id:'second-terrace-secondary', modelKey:'second__Terrace-42789', floor:'second', name:'Terrazza mansarda 2', icon:'fa-umbrella-beach', type:'outdoor', aliases:['terrazza mansarda 2'],
    entities:{temperature:'sensor.terrazza_mansarda_2_temperatura',lights:'light.terrazza_mansarda_2'},
    candidates:{lights:['light.luce_terrazza_mansarda_2']}
  }
];
