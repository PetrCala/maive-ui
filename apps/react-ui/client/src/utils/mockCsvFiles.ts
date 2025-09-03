// Mock CSV files for testing and development
// Each file contains realistic data with effect size, standard error, sample size, and study ID

export const mockCsvFiles = [
  {
    name: "Mock Data 1",
    content: `1.0,0.187317162,60,1
2.0,0.187317162,60,2
3.0,0.206284249,50,3
4.0,0.277555467,28,4
5.0,0.206284249,50,5
6.0,0.129506486,128,6
7.0,0.129506486,128,7
8.0,0.206284249,50,8
9.0,0.104726619,201,9
10.0,0.073572612,268,10
11.0,0.135293575,122,11
12.0,0.075860256,265,12
13.0,0.206284249,50,13
14.0,0.129640745,122,14
15.0,0.197075144,54,15
16.0,0.193762379,60,16`,
    filename: "mock_data_1.csv",
    original_filename: "Schimmack.csv",
  },
  {
    name: "Mock Data 2",
    content: `2.31006267,0.06751074,1178,Hauser et al (2007)
0.38592932,0.04641364,575,Hauser et al (2007)
1.75873506,0.64838443,11,Pellizzoni et al (2010)
-0.2095044,0.21659697,18,Moore et al (2008)
0.0,0.26723002,11,May (unpublished)
2.8338239,0.69901748,18,Mikhail (2002)
0.91520383,0.31786308,34,Nichols & Mallon (2006)
1.92964662,0.60478374,26,Nichols & Mallon (2006)
0.42452226,0.36005729,8,Zimmerman (2013)
1.98477938,0.48242052,23,Mikhail (2011)
1.7036023,0.55415068,12,Mikhail (2011)
0.31977001,0.12798912,83,Mikhail (2011)
0.15988501,0.21659697,19,May (unpublished)
0.70018606,0.19831281,32,May (unpublished)
0.50170812,0.23488113,20,May (unpublished)
1.20740746,0.06329132,560,Ahlenius & Taennsjoe (2012)
0.85455779,0.09985964,188,Cote et al (2013)
1.12470832,0.25175881,33,Lanteri et al (2008)
0.88212417,0.13080206,188,Lotto et al (2014)
1.07508883,0.53586652,10,Koenigs et al (2007)
1.51063764,0.13924091,276,Rusch (2015)
0.9207171,0.28692066,22,Sario et al (2012)
1.59885006,0.10407906,295,Costa et al (2014)
1.02546935,0.17440275,67,Fumagali et al (2010)
0.2756638,0.3220825,13,Koengis et al (2012)
1.03098262,0.29957892,22,Manfriniti (2013)
0.12680535,0.26582355,21,Moore et al (2011a)
0.28669036,0.25316529,28,Moore et al (2011a)
0.34733639,0.18002865,47,Moore et al (2011b)
0.41900898,0.21940991,39,Nakamura (unpublished)`,
    filename: "mock_data_2.csv",
    original_filename: "Felts.csv",
  },
  {
    name: "Mock Data 3",
    content: `0.42309383,0.17407766,36,Boelter & Reisberg (1999)
0.34164003,0.17407766,36,Boelter & Reisberg (1999)
0.34164003,0.16439898,40,Dodson et al. (1997)
0.26073295,0.11396058,80,Dodson et al. (1997)
0.69317728,0.09245003,120,Fallshore & Schooler (1995)
0.10004167,0.07980869,160,Fallshore & Schooler (1995)
0.77842319,0.14002801,54,Finger & Pezdek (1999)
0.10004167,0.1490712,48,Lovett et al. (1992)
-0.28091556,0.1490712,48,Lovett et al. (1992)
-0.26073295,0.13363062,59,Lovett et al. (1992)
-0.40267199,0.13245323,60,Meissner et al. (2001)
0.0,0.13245323,60,Meissner et al. (2001)
0.69317728,0.13245323,60,Meissner et al. (2001)
0.32136708,0.16666667,39,Memon et al. (1999)
0.86491472,0.19245009,30,Miner & Reisberg (1999)
-0.1802431,0.21821789,24,Miner & Reisberg (1999)
0.0,0.24253562,20,Miner & Reisberg (1999)
0.16017072,0.066519015,229,Ryan (1992)
0.22044393,0.078567423,165,Ryan & Schooler (1998)
0.54658496,0.10846523,88,Schooler & Engstler-Schooler (1990)
0.6720444,0.12216944,70,Schooler & Engstler-Schooler (1990)
0.44355795,0.11547005,78,Schooler & Engstler-Schooler (1990)
0.50522465,0.125,67,Schooler & Engstler-Schooler (1990)
0.62997818,0.13736056,56,Schooler & Engstler-Schooler (1990)
0.34164003,0.13245323,60,Schooler et al. (1996)
0.14011437,0.13245323,60,Schooler et al. (1996)
-0.30112627,0.13018891,62,Tunnichiff & Clark (1999)
0.22044393,0.13363062,59,Westerman & Larsen (1997)
-0.6720444,0.14586499,50,Yu & Geiselman (1993)`,
    filename: "mock_data_3.csv",
    original_filename: "Meissner.csv",
  },
  {
    name: "Mock Data 4",
    content: `1.40956874,1.60389498,1,4
0.934580279,2.728439649,2,20
1.005538362,1.20559614,1,2
1.607434135,1.374603181,1,8
1.651153459,1.396722781,1,5
1.918972533,3.613489324,3,7
1.920311247,1.164320239,1,6
1.93463514,1.997635027,1,11
1.963465727,1.628438568,1,3
2.031347089,1.132067753,1,9
2.045100417,2.153126968,2,20
2.116708312,1.450797664,1,8
2.117248244,1.424396816,1,10
2.129764751,2.027058107,2,1
2.147580307,1.822909745,1,14
2.209095385,1.149889829,1,1
2.26248256,2.139327545,2,16
2.276366749,1.67569803,1,15
2.289479082,1.094165279,1,17
2.358873001,1.083095404,1,9
2.372323887,2.633605597,2,1
2.450022322,1.712450551,1,14
2.473466143,1.329778006,1,13
2.477301814,1.155021847,1,19
2.510585696,2.085526256,2,13
2.551019991,1.201871141,1,10
2.557891041,1.118981742,1,18
2.58784183,2.804591196,2,4
2.596526829,1.899224626,1,10
2.687156785,2.190487128,2,4
2.709855354,1.482758586,1,11
2.735099376,1.877306217,1,14
2.744686411,1.622095908,1,9
2.770899765,1.340824271,1,16
2.774250981,1.303360891,1,16
2.824236195,0.843519921,0,18
2.86894279,1.309065337,1,9
3.020979848,1.194038258,1,15
3.031109914,1.768053051,1,8
3.035132854,3.016886798,3,3
3.061912963,1.946623017,1,13
3.136903043,0.885152689,0,17
3.181718629,3.389668019,3,20
3.20897506,0.73687721,0,19
3.259545753,1.089055097,1,6
3.272874934,3.484421145,3,5
3.365167205,4.005944333,4,7
3.383079631,1.408657478,1,6
3.384849894,0.993471768,0,9
3.446714678,2.629391636,2,3
3.484112885,2.133373527,2,7
3.535713482,1.880508804,1,7
3.634465653,2.769934507,2,14
3.678852308,1.671666868,1,8
3.805941011,1.405774792,1,15
4.029057044,2.073040934,2,5
4.053493047,1.584130462,1,1
4.055953087,0.982876967,0,17
4.076184879,1.038720785,1,18
4.102284835,1.674630885,1,18
4.140236612,1.418978843,1,2
4.266036385,2.027967967,2,12
4.302745946,2.064053238,2,18
4.342690579,2.283173737,2,16
4.379409826,1.156617377,1,2
4.420183519,1.264860248,1,17
4.43683006,1.221996474,1,13
4.675067539,1.199732103,1,19
4.802140975,2.91967613,2,3
4.822392311,0.863306722,0,19
4.839813542,1.797308101,1,17
5.079092567,1.95432687,1,12
5.600660199,2.278827786,2,14`,
    filename: "mock_data_4.csv",
    original_filename: "Havranek Demo.csv",
  },
  {
    name: "Mock Data 6",
    content: `1.1952,0.314765685,54,1985ArkThe02A
1.84,0.230595043,108,1985ArkThe03A
0.3126,0.160194423,158,1985ArkThe04A
0.5693,0.170552848,145,1985ArkThe07A
1.9406,0.253158215,95,1985ArkThe08A
-1.3665,0.177601007,197,1990GarDe-01A
-1.7677,0.382594386,38,1990GarDe-02AD
-0.4624,0.324611739,39,1990GarDe-03A
0.6139,0.126000607,407,1990GarThr01A
0.3254,0.214607003,88,1991GarEff01A
0.3939,0.248558834,66,1991GarEff02A
-1.628,0.159462977,214,1995HeaEsc01A
-1.5233,0.178643723,162,1995HeaEsc03A
0.7991,0.163818369,161,1995HeaEsc03B
0.5454,0.18746049,156,1995KeiThe1A
0.3767,0.18592343,157,1995KeiThe1B
1.5286,0.326648914,50,1995TanSun01C
0.2014,0.317781142,41,1995TanSun01D
0.766,0.293250345,50,1995TanSun02A
0.2816,0.290102327,48,1995TanSun02B
0.9214,0.15591786,182,1997ZeeA r01A
0.6537,0.324563624,40,1998DicThe01A
-0.3565,0.318729749,40,1998DicThe01B
0.229,0.198434354,106,1998GarToo01A
0.7168,0.250202892,68,1998GarToo02AB
0.3897,0.356893412,32,1998GarToo03ABCD
0.6085,0.264106548,60,1998GouPay03A
1.4482,0.290075899,60,1998GouPay03B
0.1401,0.258515441,60,1998GouPay03C
0.1374,0.258503365,60,1998GouPay03D
0.1998,0.334163966,36,1999BorRat1A
0.341,0.31851768,40,1999BorRat1B
1.6609,0.271476055,73,2000ArkThe01A
0.4645,0.133820098,230,2000ArkThe02A
-0.6802,0.208869347,97,2000KeaSun01A
0.5636,0.207072069,97,2000KeaSun01B
0.7266,0.214135831,93,2000KeiA C1A
1.7006,0.301275626,60,2000KeiA C1B
1.3156,0.20480019,116,2000KeiA C1C
0.9379,0.087643389,579,2000KeiWhy
0.7484,0.207935,99,2001aSomThe02A
0.4765,0.226757749,80,2001aSomThe03A
0.482,0.226830388,80,2001aSomThe03B
1.332,0.349539411,40,2001aSomThe04A
1.3205,0.135094667,340,2001MooLoo01A
0.1552,0.258587301,60,2001SomThe05A
0.895,0.270817051,60,2001SomThe05B
0.2411,0.105696085,480,2001SomTra03A
0.247,0.039647946,2565,2001SomTra03A
-0.6429,0.418661568,24,2002KarImp01A
-0.6429,0.418661568,24,2002KarImp01B
-0.5448,0.467265478,19,2002KarImp02A
-0.5448,0.467265478,19,2002KarImp02B
0.1979,0.378888516,28,2002KarImp03A
1.1648,0.225409271,116,2002TanFin1
0.6946,0.195539415,81,2002TanFin3
0.8784,0.26048597,75,2002TanFin5
0.8349,0.326345597,46,2003DijThe
0.9873,0.324234276,47,2003DijThe
1.5174,0.241082428,143,2005GreDer01A
-0.2618,0.161330549,155,2007FriSea
0.1144,0.244565864,67,2007JanRes01A
0.0754,0.187412532,114,2007JanRes01B
0.0,0.25,64,2007JanRes01C
-0.7619,0.256940363,65,2007JanRes01D
2.778,0.371338818,57,2008FenMen01A
1.7324,0.228888988,105,2008FenMen01B
1.2852,0.281300982,61,2008FenMen01C
1.2412,0.244189699,80,2008FenMen01D
2.778,0.328104602,73,2008GinDo01A
2.778,0.422617439,44,2008GinDo02A
1.1818,0.327060155,44,2008GinDo03A
1.5442,0.39181646,36,2008GinDo03B
0.5022,0.109839096,171,2008LiuCan01A
0.93,0.171900165,75,2008StrAre01A
-0.4714,0.167804293,73,2008StrAre01B
0.2794,0.20826098,145,2009ColSun
-0.0142,0.086630708,533,2010AshCan01A
0.6829,0.068966497,890,2010AshCan02A
0.1739,0.125209832,288,2010ColSun
-0.8174,0.289854866,53,2010KenImp
0.9586,0.243862481,75,2010PutWho01A
0.3472,0.222520866,82,2011JenThe01A
0.1608,0.166935789,144,2011JenThe02A
0.6264,0.252590669,66,2011JusThe01A
-0.4143,0.147495053,188,2012BraAss01A
0.1962,0.241577634,69,2012DuxSun1A
0.476,0.246049708,68,2012DuxSun1B
0.0153,0.194398471,106,2012DuxSun2A
-0.2046,0.187560555,115,2012DuxSun2B
0.7419,0.201791279,105,2012KwaEff02A
1.3097,0.223793033,97,2012KwaEff02B
0.7933,0.17811642,136,2012KwaEff03A
0.9087,0.137621449,233,2012KwaEff04A
0.5176,0.224530808,82,2012VetZur
0.5183,0.18979854,135,2012WesIna3
0.303,0.132630649,230,2013HerBea
0.3429,0.152900004,195,2013RobDie01A
0.4435,0.178936662,128,2010FerTheA
0.2323,0.177371909,128,2010FerTheA`,
    filename: "mock_data_6.csv",
    original_filename: "Roth.csv",
  },
  {
    name: "Mock Data 7",
    content: `0.88,0.39,40,Alberts, Martijn, Greb, Merckelbach, & Vries (2007), Study 1
1.62,0.47,40,Alberts, Martijn, Greb, Merckelbach, & Vries (2007), Study 2
1.79,0.47,44,Baumeister, Bratslavsky, Muraven & Tice (1998), Study 1
1.9,0.81,20,Baumeister, Bratslavsky, Muraven & Tice (1998), Study 2
0.76,0.45,30,Baumeister, Bratslavsky, Muraven & Tice (1998), Study 3
0.59,0.24,84,Baumeister, Bratslavsky, Muraven & Tice (1998), Study 4
0.56,0.32,49,Bray, Ginis, Hicks & Woodgate (2008), Study 1
0.53,0.27,68,Bruyneel, Dewitte, Franses, & Dekimpe (2009), Study 2
0.95,0.5,27,Bruyneel, Dewitte, Franses, & Dekimpe (2009), Study 3
0.59,0.34,44,Bruyneel, Dewitte, Franses, & Dekimpe (2009), Study 4
0.55,0.23,89,Bruyneel, Dewitte, Vohs & Warlop (2006), Study 1
0.64,0.35,44,Bruyneel, Dewitte, Vohs & Warlop (2006), Study 2
0.61,0.36,42,Bruyneel, Dewitte, Vohs & Warlop (2006), Study 3
0.47,0.26,72,Burkley (2008), Study 1
0.91,0.57,22,Burkley (2008), Study 2
0.45,0.24,78,Burkley (2008), Study 3
0.59,0.29,60,Burkley (2008), Study 4
0.73,0.39,37,Ciarocco, Sommer & Baumeister (2001), Study 1
0.94,0.54,24,Ciarocco, Sommer & Baumeister (2001), Study 2
1.12,0.51,28,DeWall, Baumeister, Gailliot, & Maner (2008), Study 1
0.96,0.47,30,DeWall, Baumeister, Gailliot, & Maner (2008), Study 2
0.37,0.17,146,DeWall, Baumeister, Gailliot, & Maner (2008), Study 3
0.66,0.41,33,DeWall, Baumeister, Stillman & Gailliot (2007), Study 1
0.67,0.32,53,DeWall, Baumeister, Stillman & Gailliot (2007), Study 2
0.92,0.34,51,DeWall, Baumeister, Stillman & Gailliot (2007), Study 3
0.52,0.22,97,DeWall, Baumeister, Stillman & Gailliot (2007), Study 4
0.68,0.38,39,Fennis, Janssen, & Vohs (2009), Study 1
0.59,0.29,60,Fennis, Janssen, & Vohs (2009), Study 2
1.18,0.39,46,Fennis, Janssen, & Vohs (2009), Study 2a
0.77,0.4,37,Fennis, Janssen, & Vohs (2009), Study 3
1.16,0.24,108,Fennis, Janssen, & Vohs (2009), Study 4
0.57,0.22,100,Fennis, Janssen, & Vohs (2009), Study 5
0.38,0.32,46,Finkel & Campbell (2001), Study 2
0.91,0.51,26,Finkel, Campbell, Brunell, Dalton, Scarbeck & Chartrand (2006), Study 1
0.81,0.32,54,Finkel, Campbell, Brunell, Dalton, Scarbeck & Chartrand (2006), Study 2
0.79,0.35,46,Finkel, Campbell, Brunell, Dalton, Scarbeck & Chartrand (2006), Study 3
0.66,0.42,32,Finkel, Campbell, Brunell, Dalton, Scarbeck & Chartrand (2006), Study 4
0.9,0.48,29,Finkel, Campbell, Brunell, Dalton, Scarbeck & Chartrand (2006), Study 5
1.41,0.82,16,Finkel, DeWall, Slotter, Oaten, & Foshee (2009), Study 4
0.65,0.22,100,Fischer, Greitemeyer & Frey (2007), Study 1
0.46,0.22,97,Fischer, Greitemeyer & Frey (2007), Study 2
0.62,0.3,56,Fischer, Greitemeyer & Frey (2007), Study 3
0.62,0.32,52,Fischer, Greitemeyer & Frey (2007), Study 4
0.77,0.45,30,Fischer, Greitemeyer & Frey (2007), Study 5
0.62,0.33,49,Fischer, Greitemeyer & Frey (2008), Study 1
0.65,0.3,56,Fischer, Greitemeyer & Frey (2008), Study 2
0.84,0.41,36,Fischer, Greitemeyer & Frey (2008), Study 3
0.86,0.35,48,Fischer, Greitemeyer & Frey (2008), Study 4
0.34,0.26,69,Friese, Hofmann & Wanke (2008), Study 2
0.31,0.31,48,Friese, Hofmann & Wanke (2008), Study 3
0.37,0.4,32,Gailliot & Baumeister (2007), Study 1
0.99,0.51,27,Gailliot & Baumeister (2007), Study 2
0.92,0.59,21,Gailliot & Baumeister (2007), Study 3
0.73,0.29,62,Gailliot et al. (2007), Study 7
0.46,0.25,73,Gailliot et al. (2007), Study 8
0.89,0.39,40,Gailliot, Plant, Butz & Baumeister (2007), Study 1
0.4,0.21,98,Gailliot, Plant, Butz & Baumeister (2007), Study 2
0.38,0.16,172,Gailliot, Plant, Butz & Baumeister (2007), Study 3
0.99,0.64,19,Gailliot, Schmeichel & Baumeister (2006), Study 2
0.49,0.27,67,Gailliot, Schmeichel & Baumeister (2006), Study 3
0.59,0.3,57,Gailliot, Schmeichel & Baumeister (2006), Study 6
0.83,0.61,19,Gailliot, Schmeichel & Baumeister (2006), Study 7S1
0.28,0.54,19,Gailliot, Schmeichel & Baumeister (2006), Study 7S2
0.62,0.3,57,Gailliot, Schmeichel & Baumeister (2006), Study 8
0.7,0.31,55,Gailliot, Schmeichel & Baumeister (2006), Study 9
1.83,0.7,24,Gailliot, Schmeichel, & Maner (2007), Study 1
0.52,0.33,46,Geeraert & Yzerbyt (2007), Study 1b
1.12,0.47,32,Geeraert & Yzerbyt (2007), Study 2b
0.66,0.36,42,Gordijin, Hindricks, Koomen, Dijksterhuis & Knippenberg (2004), Study 2
0.73,0.28,66,Gordijin, Hindricks, Koomen, Dijksterhuis & Knippenberg (2004), Study 4
0.46,0.26,72,Govorun & Payne (2006), Study 
0.12,0.3,50,Hofmann, Rauch & Gawronski (2007), Study 
1.68,0.54,33,Inzlicht & Gutsell (2007), Study 
0.84,0.37,42,Inzlicht, McKay & Aronson (2006), Study 2
0.66,0.29,61,Inzlicht, McKay & Aronson (2006), Study 3
0.94,0.23,107,Janssen, Fennis, Pruyn & Vohs (2008), Study 2
0.69,0.25,81,Johns, Inzlicht, & Schmader (2008), Study 1
0.55,0.37,39,Johns, Inzlicht, & Schmader (2008), Study 3
1.0,0.42,37,Johns, Inzlicht, & Schmader (2008), Study 4
0.18,0.21,99,Joireman, Balliet, Sprott, Spangenberg & Schultz (2008), Study 3
0.53,0.29,59,Kahan, Polivy & Herman (2003), Study 
0.58,0.27,68,Legault, Green-Demers, & Eadie (2009), Study 2
0.7,0.39,37,Martijn, Alberts, Merckelbach, Havermans, Huijts & de Vries (2007), Study 
0.72,0.42,33,Martijn, Tenbult, Merckelbach, Dreezens & de Vries (2002), Study 
0.42,0.28,59,Masicampo & Baumeister (2008), Study 
0.58,0.24,84,Mead, Baumeister, Gino, Schweitzer, & Ariely (2009), Study 1
0.9,0.27,78,Mead, Baumeister, Gino, Schweitzer, & Ariely (2009), Study 2
0.71,0.5,25,Moller, Deci, & Ryan (2006), Study 1
0.85,0.32,56,Muraven (2008), Study 1
0.66,0.36,41,Muraven (2008), Study 2
0.53,0.29,58,Muraven, Collins & Nienhaus (2002), Study 
1.9,0.95,16,Muraven, Gagne & Rosman (2008), Study 1
1.14,0.37,48,Muraven, Gagne & Rosman (2008), Study 3
0.6,0.43,30,Muraven, Rosman & Gagne (2007), Study 3
0.11,0.16,160,Muraven & Shmueli (2006), Study 
0.59,0.34,46,Muraven, Shmueli & Burkley (2006), Study 1
0.47,0.39,34,Muraven, Shmueli & Burkley (2006), Study 2
0.7,0.38,38,Muraven, Shmueli & Burkley (2006), Study 4
0.6,0.35,43,Muraven & Slessareva (2003), Study 1
0.62,0.36,41,Muraven & Slessareva (2003), Study 2
0.59,0.5,24,Muraven & Slessareva (2003), Study 3
0.64,0.29,60,Muraven, Tice & Baumeister (1998), Study 1
0.75,0.42,34,Muraven, Tice & Baumeister (1998), Study 2
0.57,0.32,49,Muraven, Tice & Baumeister (1998), Study 3
0.84,0.44,32,Neshat-Doost, Dagleish & Golden (2008), Study 
1.08,0.29,71,Oaten, Williams, Jones & Zadro (2008), Study 1
0.59,0.26,73,Oaten, Williams, Jones & Zadro (2008), Study 2
0.98,0.41,38,Oikawa (2005), Study 1
1.53,0.46,40,Oikawa (2005), Study 2
0.44,0.23,85,Ostafin, Marlatt & Greenwald (2008), Study 
0.56,0.3,57,Park, Glaser & Knowles (2008), Study 
0.29,0.12,284,Pocheptsova, Amir, Dhar & Baumeister (2009), Study 1
0.18,0.09,501,Pocheptsova, Amir, Dhar & Baumeister (2009), Study 2
0.18,0.2,105,Pocheptsova, Amir, Dhar & Baumeister (2009), Study 3
0.25,0.26,64,Pocheptsova, Amir, Dhar & Baumeister (2009), Study 4
0.15,0.16,162,Pocheptsova, Amir, Dhar & Baumeister (2009), Study 5
1.42,0.65,22,Richeson & Shelton (2003), Study 
0.79,0.3,60,Richeson & Trawalter (2005), Study 1
0.93,0.45,32,Richeson & Trawalter (2005), Study 2
0.91,0.43,34,Richeson & Trawalter (2005), Study 3
0.95,0.47,30,Richeson, Trawalter & Shelton (2005), Study 
0.45,0.24,79,Schmeichel (2007), Study 1S1
0.52,0.28,62,Schmeichel (2007), Study 1S2
0.51,0.28,61,Schmeichel (2007), Study 2S1
0.08,0.27,61,Schmeichel (2007), Study 2S2
0.68,0.44,30,Schmeichel (2007), Study 3
0.53,0.27,65,Schmeichel (2007), Study 4
0.85,0.34,50,Schmeichel, Demaree, Robinson & Pu (2006), Study 
0.61,0.29,59,Schmeichel & Vohs (2009), Study 1
0.75,0.27,72,Schmeichel & Vohs (2009), Study 2
1.61,0.65,24,Schmeichel, Vohs & Baumeister (2003), Study 1
0.43,0.37,37,Schmeichel, Vohs & Baumeister (2003), Study 2
0.9,0.42,36,Schmeichel, Vohs & Baumeister (2003), Study 3
0.41,0.25,73,Seeley & Gardner (2003), Study 1
0.47,0.3,55,Seeley & Gardner (2003), Study 2
0.65,0.24,83,Segerstrom & Nes (2007), Study 
0.67,0.3,57,Shamosh & Gray (2007), Study 
0.19,0.21,101,Shmueli & Prochaska (2009), Study 
0.47,0.36,40,Stewart, Wright, Hui & Simmons (2009), Study 
0.02,0.34,40,Stillman, Tice, Fincham & Lambert (2009), Study 1
0.04,0.37,33,Stillman, Tice, Fincham & Lambert (2009), Study 3
0.82,0.3,60,Stucke & Baumeister (2006), Study 1
0.6,0.28,62,Stucke & Baumeister (2006), Study 2
1.2,0.39,45,Stucke & Baumeister (2006), Study 3
0.61,0.23,93,Tice, Baumeister, Shmueli & Muraven (2007), Study 2
0.83,0.35,45,Trawalter & Richeson (2006), Study 
1.07,0.46,33,Tyler (2008), Study 1
0.97,0.47,30,Tyler (2008), Study 2
1.36,0.53,30,Tyler (2008), Study 3
0.58,0.29,60,Tyler (2008), Study 4
1.56,0.37,60,Tyler & Burns (2008), Study 1
0.99,0.4,40,Tyler & Burns (2008), Study 2
1.36,0.69,20,Tyler & Burns (2009), Study 1
1.22,0.66,20,Tyler & Burns (2009), Study 2S1
1.9,0.81,20,Tyler & Burns (2009), Study 2S2
0.44,0.54,20,Tyler & Burns (2009), Study 2S3
1.19,0.42,40,Tyler & Burns (2009), Study 3
0.58,0.27,68,Vohs, Baumeister & Ciarocco (2005), Study 1
0.64,0.3,58,Vohs, Baumeister & Ciarocco (2005), Study 2
1.59,0.56,30,Vohs, Baumeister & Ciarocco (2005), Study 3
1.06,0.32,60,Vohs, Baumeister & Ciarocco (2005), Study 4
0.8,0.42,34,Vohs, Baumeister & Ciarocco (2005), Study 5
0.63,0.3,57,Vohs, Baumeister & Ciarocco (2005), Study 6
0.7,0.27,71,Vohs, Baumeister & Ciarocco (2005), Study 7
0.79,0.44,32,Vohs, Baumeister & Ciarocco (2005), Study 8
1.34,0.52,30,Vohs, Baumeister, Schmeichel, Twenge, Nelson & Tice (2008), Study 1a
1.01,0.48,30,Vohs, Baumeister, Schmeichel, Twenge, Nelson & Tice (2008), Study 1b
0.98,0.53,25,Vohs, Baumeister, Schmeichel, Twenge, Nelson & Tice (2008), Study 2
0.99,0.52,26,Vohs, Baumeister, Schmeichel, Twenge, Nelson & Tice (2008), Study 3
0.84,0.39,40,Vohs, Baumeister, Schmeichel, Twenge, Nelson & Tice (2008), Study 4a
0.93,0.39,40,Vohs, Baumeister, Schmeichel, Twenge, Nelson & Tice (2008), Study 4b
0.73,0.29,64,Vohs, Baumeister, Schmeichel, Twenge, Nelson & Tice (2008), Study 6
0.96,0.43,35,Vohs & Faber (2007), Study 1
1.27,0.31,70,Vohs & Faber (2007), Study 2
1.38,0.44,40,Vohs & Faber (2007), Study 3
1.4,0.75,18,Vohs & Heatherton (2000), Study 1
0.77,0.47,28,Vohs & Heatherton (2000), Study 2
0.76,0.4,36,Vohs & Heatherton (2000), Study 3
1.07,0.37,48,Vohs & Schmeichel (2003), Study 3
0.76,0.34,47,Vohs & Schmeichel (2003), Study 4
1.13,0.59,23,Wallace & Baumeister (2002), Study 
1.25,0.57,25,Wan & Sternthal (2008), Study 1
1.27,0.55,27,Wan & Sternthal (2008), Study 2
0.77,0.33,50,Wan & Sternthal (2008), Study 3
1.11,0.4,42,Wan & Sternthal (2008), Study 4
0.95,0.46,31,Webb & Sheeran (2003), Study 1
1.73,0.61,28,Webb & Sheeran (2003), Study 2
0.9,0.29,68,Wheeler, Brinol & Hermann (2007), Study 
0.3,0.31,48,Wright et al. (2007), Study 1S1
0.13,0.31,46,Wright et al. (2007), Study 1S2
0.34,0.31,49,Wright et al. (2007), Study 2S1
-0.11,0.3,47,Wright et al. (2007), Study 2S2
0.21,0.36,36,Wright, Martin & Bland (2003), Study S1
0.21,0.36,37,Wright, Martin & Bland (2003), Study S2
-0.11,0.28,53,Wright , Stewart & Barnett (2008), Study S1
0.65,0.31,53,Wright , Stewart & Barnett (2008), Study S2
0.65,0.28,65,Zyphur, Warren, Landis & Thoresen (2007), Study 1
0.56,0.25,80,Zyphur, Warren, Landis & Thoresen (2007), Study 2`,
    filename: "mock_data_7.csv",
    original_filename: "Hagger.csv",
  },
  {
    name: "Mock Data 8",
    content: `0.25,0.12576277,265,Critcher & Gilovich (2008) 1
0.3,0.143482822,207,Critcher & Gilovich (2008) 2 
0.32,0.14869198,194,Critcher & Gilovich (2008) 3 
0.53,0.293155846,57,Dogerlioglu-Demir & Koças (2014) 1a 
0.07,0.27554209,57,Dogerlioglu-Demir & Koças (2014) 1b 
0.94,0.502120127,27,Dogerlioglu-Demir & Koças (2014) 1c 
-0.74,0.416381001,27,Dogerlioglu-Demir & Koças (2014) 1d 
-0.44,0.316165105,43,Dogerlioglu-Demir & Koças (2014) 1e
-0.19,0.316065048,43,Dogerlioglu-Demir & Koças (2014) 1f 
0.62,0.120934245,314,Dogerlioglu-Demir & Koças (2014) 2 
0.63,0.303240182,56,Englich (2008) 
0.76,0.34431155,47,Lee (2010) 1a 
0.57,0.330887638,47,Lee (2010) 1b Immediate Low Similar 0.57 47
0.69,0.38978366,37,Mussweiler & Englich (2005) 1
0.61,0.355799405,42,Mussweiler & Englich (2005) 2
-0.52,0.267808159,60,Nunes & Boatwright (2004) 1 
0.28,0.270455754,62,Reitsma-van Rooijen & Damen (2006)
0.28,0.153457699,181,Wong & Kwong (2000) 1 
0.37,0.174014134,145,Yan & Duclos (2013) 1
0.34,0.175267939,142,Yan & Duclos (2013) 3 
0.52,0.205750023,110,Yan & Duclos (2013) 5b `,
    filename: "mock_data_8.csv",
    original_filename: "Henriksson.csv",
  },
  {
    name: "Mock Data 9",
    content: `-0.13285027,0.1968464,207,Capraro (2016)
-0.16172695,0.14254472,291,Capraro & Cococcioni (2016) S-1
-0.12566695,0.11162195,403,Capraro & Cococcioni (2016) S-2
0.052161388,0.11140055,459,Capraro & Cococcioni (2016) S-3
0.093287222,0.080971114,751,Cone & Rand (2014)
0.38326666,0.15739723,104,De Drue et al. (2015)
-0.11111111,0.23972222,50,De Haan & Van Veldhuizen (2015) Pilot
0.074367225,0.20213306,103,De Haan & Van Veldhuizen (2015) S-1
0.018215001,0.18300833,121,De Haan & Van Veldhuizen (2015) S-2
0.15166667,0.1127825,166,Dossing et al. (2015)
0.49603167,0.39052111,48,Duffy & Smith (2014) Last period
0.20212555,0.11563028,42,Halali et al. (2014) S-2a
0.24926889,0.11173333,38,Halali et al. (2014) S-2b
0.10768667,0.15649667,301,Levine et al. (2016) S-1
0.61834085,0.1530575,290,Levine et al. (2016) S-2
0.97692055,0.15226333,293,Levine et al. (2016) S-3
0.88426334,0.13112278,405,Levine et al. (2016) S-4
0.5426228,0.080374166,692,Levine et al. (2016) S-5
-0.082304448,0.11578417,120,Liu & Hao (2011)
-0.24722221,0.13915649,220,Lohse (in press)
0.27964333,0.14675805,246,Lotz (2015)
-0.080994166,0.13558055,151,Ma et al. (2015)
-0.037824724,0.10818361,295,Montealegre & Jimenez-Leal (2015) S-1
0.17603639,0.16780777,104,Montealegre & Jimenez-Leal (2015) S-2
0.61728394,0.61728394,6,Neo et al. (2013) S-1 P2
0.01754386,0.2028511,144,Protzko et al. (2016)
0.12635,0.076891392,680,Rand et al. (2012) S-6
0.23840973,0.14751361,211,Rand et al. (2012) S-7
0.20768729,0.07273639,864,Rand et al. (2012) S-8
-0.059013203,0.082416251,696,Rand et al. (2012) S-9
0.063575275,0.11797139,163,Rand et al. (2014) S-B TG P2
0.27316001,0.15498139,316,Rand et al. (2014) S-C
0.043334443,0.076219164,801,Rand et al. (2014) S-E
0.31477472,0.15336111,48,Rand et al. (2014) S-F
-0.056306388,0.085670002,666,Rand et al. (2014) S-J
0.039604168,0.17416194,150,Rand et al. (2014) S-L
-0.027615277,0.10153972,603,Rand et al. (2014) S-N
0.021454444,0.19736612,163,Rand et al. (2014) S-O
-0.083499163,0.14662223,279,Rand et al. (2014) S-Supp
0.34845084,0.15557,210,Rand et al. (2015) S-1
0.043015298,0.063966691,1152,Rand et al. (2015) S-2
-0.1495343,0.10603049,479,Rand & Kraft-Todd (2014) S-1
0.3037211,0.14602751,101,Rantapuska et al. (2014) PD, PGG, TG P2
-0.028574722,0.078467779,1149,Tinghog et al. (2013) S-5
0.17089416,0.10362222,288,Urbig et al. (2015) 1-shot and conditional PGG
0.096659169,0.14794278,148,Verkoeijen & Bouwmeester (2014) S-1
-0.035526842,0.21310256,117,Verkoeijen & Bouwmeester (2014) S-2a
-0.21708117,0.23416716,91,Verkoeijen & Bouwmeester (2014) S-2b
0.18626744,0.20994937,119,Verkoeijen & Bouwmeester (2014) S-2c
-0.10227271,0.20837423,105,Verkoeijen & Bouwmeester (2014) S-3
-0.16493611,0.12084445,174,Wang et al. (2015)`,
    filename: "mock_data_9.csv",
    original_filename: "Rand.csv",
  },
  {
    name: "Mock Data 10",
    content: `0.08,0.244948974,64,1
0.27,0.2,91,1
-0.05,0.1,567,2
-0.08,0.223606798,86,3
0.07,0.223606798,86,4
0.05,0.331662479,38,4
0.49,0.282842712,49,4
0.03,0.3,47,4
0.3,0.244948974,64,5
0.54,0.244948974,65,5
-0.11,0.264575131,57,6
0.12,0.282842712,53,7
0.61,0.316227766,50,7
0.48,0.316227766,49,8
0.63,0.3,48,9
0.22,0.282842712,51,9
0.86,0.264575131,94,9
0.24,0.173205081,133,10
-0.19,0.244948974,65,10
0.04,0.264575131,61,10
-0.34,0.264575131,61,11
-0.25,0.223606798,83,11
-0.67,0.282842712,57,11
-0.17,0.331662479,38,11
0.66,0.360555128,35,12
0.17,0.3,44,12
0.47,0.316227766,42,12
-0.7,0.282842712,56,13
0.41,0.2,97,14
0.58,0.316227766,43,14
-0.15,0.1,348,14
0.04,0.282842712,49,14
0.4,0.223606798,77,14
0.54,0.223606798,86,14
0.66,0.282842712,51,14
1.26,0.3,54,14
0.6,0.244948974,74,14
0.44,0.2,116,14
0.54,0.264575131,60,14
0.35,0.2,100,14
0.23,0.1,367,14
0.3,0.141421356,192,14
0.33,0.282842712,51,15
0.58,0.331662479,39,16
0.0,0.244948974,65,17
0.79,0.264575131,65,18
0.59,0.3,48,19
0.84,0.331662479,40,20
0.53,0.282842712,50,21
0.57,0.244948974,70,21
0.36,0.2,92,21
0.44,0.223606798,84,21
0.35,0.316227766,40,22
0.16,0.282842712,50,23
0.25,0.173205081,157,23
0.42,0.244948974,68,23
0.98,0.244948974,76,23
0.62,0.2,108,24
0.6,0.223606798,94,24
0.56,0.244948974,80,25
0.39,0.223606798,80,25
0.46,0.244948974,80,25
0.56,0.244948974,66,25
-0.29,0.360555128,32,25
-0.04,0.2,92,25
-0.02,0.3,43,25
0.01,0.244948974,64,25
0.73,0.316227766,44,26
0.55,0.2,94,27
0.86,0.387298335,30,27
0.29,0.223606798,76,28
0.53,0.223606798,81,29
-0.04,0.316227766,40,29
0.83,0.331662479,40,29
0.6,0.223606798,88,29
-0.24,0.223606798,88,29
0.48,0.244948974,70,29
0.26,0.173205081,140,29
0.71,0.2,110,29
0.91,0.458257569,21,30
0.89,0.479583152,19,31
0.6,0.374165739,29,31
1.1,0.509901951,18,32
0.57,0.360555128,31,32
-0.42,0.264575131,62,32
0.0,0.1,278,32
0.38,0.223606798,84,33
0.44,0.264575131,62,33
-0.3,0.223606798,76,33
0.41,0.244948974,66,34
0.29,0.244948974,68,35`,
    filename: "mock_data_10.csv",
    original_filename: "Blanken.csv",
  },
  {
    name: "Mock Data 11",
    content: `0.12,0.267892143,60,1
0.1495,0.166825328,148,1
0.3224,0.136486499,219,1
0.0,0.36667576,34,1
0.5305,0.295720405,50,2
-0.0354,0.229821085,80,2
0.2657,0.232916673,78,2
0.24,0.309558854,46,2
0.3542,0.232916673,78,2
0.0662,0.183549881,123,2
0.6136,0.3133328,45,3
0.2753,0.267892143,60,3
0.3758,0.212321493,93,3
0.7591,0.354949655,36,3
0.1319,0.204412286,100,4
0.4796,0.334517271,40,4
0.529,0.267892143,60,5
1.1316,0.317248126,44,5
0.814,0.229821085,80,5
0.0423,0.160786173,159,5
0.3964,0.204412286,100,5
1.1869,0.267892143,60,6
0.9766,0.239502571,74,6
0.5187,0.189212027,116,7
0.0523,0.253013075,66,7
0.4455,0.241238201,73,7
0.4816,0.299005527,49,8
0.4986,0.208821088,96,8
0.2032,0.091890038,478,8
0.124,0.218568194,88,9
0.4789,0.194506328,110,9
0.029,0.159249787,162,9
0.3963,0.410323264,28,9
0.083,0.166825328,148,9
0.1382,0.208821088,96,10
1.0464,0.377410045,32,10
0.2398,0.196372358,108,11
0.2432,0.168594056,145,11
0.6259,0.153246501,174,11
0.4207,0.120337247,280,11
0.9393,0.150959514,179,11
0.4724,0.182023268,125,12
0.6187,0.334517271,40,12
0.3425,0.129039367,224,12
0.494,0.221225899,86,13`,
    filename: "mock_data_11.csv",
    original_filename: "DeCoster.csv",
  },
  {
    name: "Mock Data 12",
    content: `0.167246044,0.176128026,136,Bohm & Lind, 1992
0.872453534,0.108283179,426,Elliott & Archibald, 1989 , Study 1
0.3581,0.150988198,190,Fagley & Miller, 1990 , Study 1
0.4804,0.206535196,108,Fagley & Miller, 1990 , Study 2
0.4988,0.231165663,88,Fagley & Miller, 1987 , Study 1pre
0.9208,0.268764358,78,Fagley & Miller, 1987 , Study 2
0.7706,0.243325455,88,Frisch, 1993 , Study 1
0.4241,0.126506969,272,Frisch, 1993 , Study 2
0.5205,0.212100689,104,Highouse & Paese, 1996 , Study 1pre
0.4452,0.209589436,104,Highouse & Paese, 1996 , Study 1prosp
0.134,0.220677676,88,Highouse & Paese, 1996 , Study 1taskr
0.6381,0.236961367,88,Highouse & Paese, 1996 , Study 2prosp
0.9881,0.148125972,244,Highouse & Yce, 1996 , Study 1posneg
-0.5999,0.226501393,84,Highouse & Yce, 1996 , Study 2tr-op
0.4442,0.234970553,84,Highouse & Yce, 1996 , Study 2g-l
0.9147,0.126614793,320,Jou et al., 1996 , Study 1
0.5731,0.17034182,160,Jou et al., 1996 , Study 2
0.3009,0.154259453,180,Kopp, 1995
0.390888247,0.227338924,88,Leclerc, Schmitt & Dube, 1995 , Study 7
0.705,0.336760118,48,Levin & Chapman, 1990 , Study 1
0.662764777,0.225859368,97,Levin & Chapman, 1993 , Study 1
0.622265143,0.112772018,360,Li & Adams, 1995
0.9206,0.543054303,24,Maule, 1989 , Study 1
0.4342,0.211420007,102,Maule, 1995
0.5643,0.283226481,62,Maule, 1995 , Study Exp.2; 1
0.46,0.219238506,96,Miller & Fagley, 1991
0.952,0.138335681,274,Nightingale, 1987
1.1413,0.209158423,136,Olszanski & Lewicka, 1988
0.3779,0.201485311,110,Paese, 1995
0.7944,0.15013573,220,Paese, B & T, 1993 , Study C1, Ind
0.6074,0.145078003,220,Paese, B & T, 1993 , Study C1, gr
1.0452,0.158401757,220,Paese, B & T, 1993 , Study C2, ind
0.2748,0.138703356,220,Paese, B & T, 1993 , Study C2, gr
0.9063,0.38143483,42,Reyna & Brainerd, 1991 , Study 1
0.4215,0.175887664,144,Reyna & Brainerd, 1991 , Study 2;1
0.273571265,0.255137892,69,Ritov, B. & Hershey, 1993 , Study 1
0.769230137,0.249517597,84,Ritov, B & hershey, 1993 , Study 1;1
0.3731,0.142928287,212,Roszowski & Snelbecker, 1990
0.627476002,0.534806998,22,Rowe & Puto, 1987
0.4451,0.226435593,90,Schneider, 1992 , Study SR3
0.3207,0.222483925,90,Schneider, 1992 , Study SR5
0.2627,0.220914941,90,Schneider, 1992 , Study SR2
0.3494,0.223325129,90,Schneider, 1992 , Study SR1
0.3268,0.222659143,90,Schneider, 1992 , Study RR3
0.1975,0.219362673,90,Schneider, 1992 , Study RR5
0.3038,0.222008597,90,Schneider, 1992 , Study RR2
0.2657,0.22099177,90,Schneider, 1992 , Study RR1
0.7311,0.124970272,306,Sebora & Cornawll, 1995 , Study Pr2
0.856092132,0.298326642,63,Sitkin & Weingart, 1995 , Study 2
1.1109,0.285427736,76,Svenson & Benson, 1993 , Study 1
1.1541,0.280389711,80,Svenson & Benson, 1993 , Study 2
0.3322,0.145095298,204,Svytanek, 1991
0.8384,0.21455574,114,Takemura, 1992
0.4048,0.225068906,90,Takemura, 1994
0.4445,0.238058992,82,Takemura, 1994 , Study 2
0.5952,0.172111065,158,Takemura, 1993
0.8088,0.130876102,288,Tindale, S&s, 1993 , Study indiv
1.5378,0.416380935,48,Tindale, S & S, 1993 , Study group
0.5402,0.124860812,288,Tindale, S6S, 1993 , Study ind, pos
1.155044847,0.136486671,307,Tversky & Kahneman, 1981
0.51678361,0.080638638,673,VanderPlight &, 1990 , Study 1
0.1366,0.117028153,300,VanderPlight &Vs, 1990 , Study 2
0.645766795,0.209403951,111,VanderPlight & Vs, 1990 , Study 3
0.55489094,0.113202455,350,VanderPlight & Vs 1990 , Study 4
1.2168,0.293168705,76,VS & VDP, 1995 , Study 4,1
0.622776453,0.204614071,115,VS & VDP, 1995 , Study 4,2
0.2229,0.219940614,90,Wang & Johnston, 1995
0.6385,0.221164264,100,Wang & Johnston, 1995 , Study 2
0.4567,0.27306211,64,Wang, 1996 , Study 1
0.3342,0.237406135,80,Wang, 1996 , Study 2
0.2492,0.264982884,64,Wang, 1996 , Study 3
-0.5575,0.217894137,90,Wilson, K & S, 1987 , Study 1
0.4136,0.481681388,24,Khberger, 1995 , Study 1, adp,
0.6772,0.510510226,24,Khberger, 1995 , Study 1, pp, r
-0.4988,0.440249588,24,Khberger, 1995 , Study 1, adp,
0.2532,0.467697626,24,Khberger, 1995 , Study 1, pp, o
-0.0407,0.584264538,16,Khberger, 1995 , Study 2, adp,
1.1591,0.776944847,16,Khberger, 1995 , Study 2, pp, r
-0.182,0.574645831,16,Khberger, 1995 , Study 2, adp,
-0.133,0.577651073,16,Khberger, 1995 , Study 2, pp, o`,
    filename: "mock_data_12.csv",
    original_filename: "KÅhberger.csv",
  },
  {
    name: "Mock Data 13",
    content: `1.064954987,0.008,80322,Graham et al. (2011)
0.723076997,0.036837306,4314,Graham et al. (2011)
0.747264718,0.037273749,3766,Graham et al. (2011)
0.92559525,0.041002729,2579,Graham et al. (2011)
0.979957887,0.056488328,1563,Graham et al. (2011)
0.675520529,0.060127347,1345,Graham et al. (2011)
0.747264718,0.074743563,888,Graham et al. (2011)
0.699166665,0.073022146,884,Graham et al. (2011)
0.92559525,0.096159781,575,Graham et al. (2011)
0.699166665,0.090937189,550,Graham et al. (2011)
0.583333333,0.092728404,479,Graham et al. (2011)
0.84707582,0.17886831,153,Graham et al. (2011)
0.606043732,0.034948996,3994,Davies et al. (2014)
0.699166665,0.048592979,2213,Scott & Pound (2015)
0.771743633,0.050344651,2213,Scott & Pound (2015)
0.747264718,0.062219556,1042,Federico et al. (2013)
0.560829009,0.068772359,1042,Federico et al. (2013)
0.79652821,0.076641706,875,Kivikangas et al. (2015)
0.47267204,0.066587146,875,Kivikangas et al. (2015)
0.262225245,0.073477476,860,Miles  & Vaisey (2015)
1.154700538,0.101860021,540,Nilsson & Erlandsson (2015)
0.516397779,0.090342996,513,Cohen et al. (2014)
0.451050802,0.088312728,510,Clifford et al. (2015)
0.538520464,0.091096771,496,Dawson & Tyson (2012)
0.34502212,0.0964301,478,Kim et al. (2012)
0.34502212,0.0964301,476,Lewis & Bates (2011)
0.538520464,0.096442571,447,Lewis & Bates (2011)
0.79652821,0.102490507,426,Federico et al. (2013)
0.429579017,0.171331224,153,Cornwell & Higgins (2013), S2
0.606043732,0.176106176,146,Hirsh et al. (2010), S2
0.387050477,0.180422631,140,van Leeuwen & Park (2009)
0.606043732,0.213041603,96,Cornwell & Higgins (2013), S1`,
    filename: "mock_data_13.csv",
    original_filename: "Kivikangas.csv",
  },
  {
    name: "Mock Data 14",
    content: `0.60399997,0.287,27,1
-0.018999999,0.183,61,2
0.14399999,0.169,62,2
0.249,0.27000001,25,2
0.42899999,0.18799999,57,3
0.75099999,0.175,69,3
0.121,0.222,40,3
0.31999999,0.13699999,80,4
0.64700001,0.23899999,36,4
0.875,0.30500001,23,4
0.77399999,0.249,35,5
0.62099999,0.26100001,30,5
0.63300002,0.243,31,5
0.38600001,0.18700001,78,6
0.38600001,0.19,51,6`,
    filename: "mock_data_14.csv",
    original_filename: "Belle.csv",
  },
  {
    name: "Mock Data 15",
    content: `0.34,0.244262799,34,1
-0.16,0.190052817,51,1
0.3,0.259806125,29,1
0.36,0.26477603,29,1
0.1,0.256268222,30,2
0.57,0.231030836,39,3
0.1,0.29535448,30,3
0.48,0.321104577,31,3
0.13,0.250283291,32,4
-0.03,0.333349204,18,5
0.33,0.257879253,30,6
0.41,0.182235418,63,6
0.79,0.268046793,30,7
0.05,0.23946407,26,7
0.51,0.226766365,60,7
0.84,0.363408046,16,8
-0.06,0.21576489,42,9
0.38,0.177656498,64,9
0.69,0.300373955,23,10
0.8,0.367399657,16,11
0.05,0.229529205,37,11
0.97,0.352390645,18,11
0.92,0.328601857,20,11
0.94,0.317721624,22,11
1.28,0.376703776,17,11
0.98,0.444930728,10,12
0.54,0.259797177,50,13
0.83,0.203457609,53,13
0.0,0.199017456,15,13
0.55,0.32254186,19,13
1.3,0.245003972,43,13
0.72,0.26656561,29,13`,
    filename: "mock_data_15.csv",
    original_filename: "Miles.csv",
  },
  {
    name: "Mock Data 16",
    content: `0.542,0.274,54,1
0.559,0.306,43,2
0.419,0.201,100,2
0.651,0.262,60,2
0.474,0.201,100,2
0.52,0.259,60,3
0.696,0.32,40,4
0.597,0.282,50,4
0.616,0.288,49,4
0.711,0.32,40,5
0.435,0.291,30,6
0.586,0.274,54,6
0.64,0.283,51,6
0.541,0.239,71,6
0.54,0.182,124,6
0.4,0.237,71,7
0.563,0.241,70,7
0.447,0.227,78,7
0.561,0.226,80,7
0.637,0.214,90,7
1.013,0.331,40,7
0.636,0.283,51,8
0.571,0.256,62,8
0.414,0.204,97,9
0.625,0.261,60,9`,
    filename: "mock_data_16.csv",
    original_filename: "Rabelo.csv",
  }
];

export const getRandomMockCsvFile = () => {
  const randomIndex = Math.floor(Math.random() * mockCsvFiles.length);
  return mockCsvFiles[randomIndex];
};
