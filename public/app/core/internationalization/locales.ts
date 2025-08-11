// Info: https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry
interface Locale {
  name: string;
  code: string;
}

// Grafana does not support right-to-left languages in the UI, so to avoid confusion
// and a poor experience, we've commented out the right-to-left languages so they don't
// appear as options.
export const LOCALES: Locale[] = [
  // Afrikaans - Standard
  { name: 'Afrikaans', code: 'af' },

  // // Arabic - Standard
  // { name: 'العربية', code: 'ar' }, // Disabled because RTL

  // // Arabic - Algeria
  // { name: 'العربية (الجزائر)', code: 'ar-DZ' }, // Disabled because RTL

  // // Arabic - Kuwait
  // { name: 'العربية (الكويت)', code: 'ar-KW' }, // Disabled because RTL

  // // Arabic - Libya
  // { name: 'العربية (ليبيا)', code: 'ar-LY' }, // Disabled because RTL

  // // Arabic - Morocco
  // { name: 'العربية (المغرب)', code: 'ar-MA' }, // Disabled because RTL

  // // Arabic - Palestine
  // { name: 'العربية (فلسطين)', code: 'ar-PS' }, // Disabled because RTL

  // // Arabic - Saudi Arabia
  // { name: 'العربية (السعودية)', code: 'ar-SA' }, // Disabled because RTL

  // // Arabic - Tunisia
  // { name: 'العربية (تونس)', code: 'ar-TN' }, // Disabled because RTL

  // Azerbaijani - Azerbaijan
  { name: 'Azərbaycan dili', code: 'az' },

  // Belarusian - Belarus
  { name: 'Беларуская мова', code: 'be-BY' },

  // Bulgarian - Bulgaria
  { name: 'Български език', code: 'bg-BG' },

  // Bambara - Mali
  { name: 'Bamanankan', code: 'bm' },

  // Bengali - Standard
  { name: 'বাংলা', code: 'bn' },

  // Bengali - Bangladesh
  { name: 'বাংলা', code: 'bn-BD' },

  // Tibetan - Tibet (China) and Bhutan
  { name: 'བོད་ཡིག', code: 'bo' },

  // Breton - Brittany (France)
  { name: 'Brezhoneg', code: 'br' },

  // Bosnian - Bosnia and Herzegovina
  { name: 'Bosanski jezik', code: 'bs' },

  // Catalan - Catalonia (Spain)
  { name: 'Català', code: 'ca-ES' },

  // Czech - Czech Republic
  { name: 'Čeština', code: 'cs-CZ' },

  // Welsh - Wales (United Kingdom)
  { name: 'Cymraeg', code: 'cy-GB' },

  // Chuvash - Chuvashia (Russia)
  { name: 'Чӑвашла', code: 'cv-RU' },

  // Danish - Denmark
  { name: 'Dansk', code: 'da-DK' },

  // German - Germany
  { name: 'Deutsch', code: 'de-DE' },

  // German - Austria
  { name: 'Deutsch (Österreich)', code: 'de-AT' },

  // German - Switzerland
  { name: 'Deutsch (Schweiz)', code: 'de-CH' },

  // // Divehi/Maldivian - Maldives
  // { name: 'ދިވެހި', code: 'dv-MV' }, // Disabled because RTL

  // Greek - Greece
  { name: 'Ελληνικά', code: 'el-GR' },

  // English - Australia
  { name: 'English (Australia)', code: 'en-AU' },

  // English - Canada
  { name: 'English (Canada)', code: 'en-CA' },

  // English - United Kingdom
  { name: 'English (United Kingdom)', code: 'en-GB' },

  // English - Ireland
  { name: 'English (Ireland)', code: 'en-IE' },

  // English - Israel
  { name: 'English (Israel)', code: 'en-IL' },

  // English - India
  { name: 'English (India)', code: 'en-IN' },

  // English - New Zealand
  { name: 'English (New Zealand)', code: 'en-NZ' },

  // English - Singapore
  { name: 'English (Singapore)', code: 'en-SG' },

  // English - United States
  { name: 'English (United States)', code: 'en-US' },

  // Esperanto - International Auxiliary Language
  // { name: 'Esperanto', code: 'eo' },

  // Spanish - Spain
  { name: 'Español', code: 'es-ES' },

  // Spanish - Dominican Republic
  { name: 'Español (República Dominicana)', code: 'es-DO' },

  // Spanish - Mexico
  { name: 'Español (México)', code: 'es-MX' },

  // Spanish - United States
  { name: 'Español (Estados Unidos)', code: 'es-US' },

  // Estonian - Estonia
  { name: 'Eesti keel', code: 'et-EE' },

  // Basque - Basque Country
  { name: 'Euskara', code: 'eu-ES' },

  // // Persian - Iran
  // { name: 'فارسی', code: 'fa-IR' }, // Disabled because RTL

  // Filipino - Philippines
  { name: 'Wikang Filipino', code: 'fil-PH' },

  // Finnish - Finland
  { name: 'Suomi', code: 'fi-FI' },

  // Faroese - Faroe Islands
  { name: 'Føroyskt', code: 'fo-FO' },

  // French - France
  { name: 'Français', code: 'fr-FR' },

  // French - Canada
  { name: 'Français (Canada)', code: 'fr-CA' },

  // French - Switzerland
  { name: 'Français (Suisse)', code: 'fr-CH' },

  // West Frisian - Netherlands
  { name: 'Frysk', code: 'fy' },

  // Irish - Ireland
  { name: 'Gaeilge', code: 'ga-IE' },

  // Scottish Gaelic - Scotland (UK)
  { name: 'Gàidhlig', code: 'gd-GB' },

  // Galician - Galicia (Spain)
  { name: 'Galego', code: 'gl-ES' },

  // Konkani (Devanagari script) - India
  { name: 'कोंकणी', code: 'gom-Deva' },

  // Konkani (Latin script) - India
  { name: 'Konkani', code: 'gom-Latn' },

  // Gujarati - India
  { name: 'ગુજરાતી', code: 'gu-IN' },

  // // Hebrew - Israel
  // { name: 'עברית', code: 'he-IL' }, // Disabled because RTL

  // Hindi - India
  { name: 'हिन्दी', code: 'hi' },

  // Croatian - Croatia
  { name: 'Hrvatski jezik', code: 'hr' },

  // Hungarian - Hungary
  { name: 'Magyar nyelv', code: 'hu-HU' },

  // Armenian - Armenia
  { name: 'Հայերեն', code: 'hy-AM' },

  // Indonesian - Indonesia
  { name: 'Bahasa Indonesia', code: 'id-ID' },

  // Icelandic - Iceland
  { name: 'Íslenska', code: 'is-IS' },

  // Italian - Italy
  { name: 'Italiano', code: 'it-IT' },

  // Italian - Switzerland
  { name: 'Italiano (Svizzera)', code: 'it-CH' },

  // Japanese - Japan
  { name: '日本語', code: 'ja-JP' },

  // Javanese - Indonesia
  { name: 'ꦧꦱꦗꦮ', code: 'jv' },

  // Georgian - Georgia
  { name: 'ქართული ენა', code: 'ka-GE' },

  // Kazakh - Kazakhstan
  { name: 'Қазақ тілі', code: 'kk-KZ' },

  // Khmer - Cambodia
  { name: 'ខ្មែរ', code: 'km-KH' },

  // Kannada - India
  { name: 'ಕನ್ನಡ', code: 'kn-IN' },

  // Korean - South Korea
  { name: '한국어', code: 'ko-KR' },

  // Kurdish - Kurdistan (Iraq, Iran, Syria, Turkey)
  { name: 'Kurdî', code: 'ku' },

  // Kyrgyz - Kyrgyzstan
  { name: 'Кыргыз тили', code: 'ky-KG' },

  // Luxembourgish - Luxembourg
  { name: 'Lëtzebuergesch', code: 'lb-LU' },

  // Lao - Laos
  { name: 'ພາສາລາວ', code: 'lo-LA' },

  // Lithuanian - Lithuania
  { name: 'Lietuvių kalba', code: 'lt-LT' },

  // Latvian - Latvia
  { name: 'Latviešu valoda', code: 'lv-LV' },

  // Macedonian - North Macedonia
  { name: 'Македонски јазик', code: 'mk-MK' },

  // Malayalam - Kerala (India)
  { name: 'മലയാളം', code: 'ml-IN' },

  // Māori - New Zealand
  { name: 'Te Reo Māori', code: 'mi-NZ' },

  // Montenegrin - Montenegro
  { name: 'Црногорски језик', code: 'cnr-ME' },

  // Marathi - Maharashtra (India)
  { name: 'मराठी', code: 'mr' },

  // Malay - Malaysia, Singapore, Brunei
  { name: 'Bahasa Melayu', code: 'ms' },

  // Maltese - Malta
  { name: 'Malti', code: 'mt-MT' },

  // Mongolian - Mongolia
  { name: 'Монгол хэл', code: 'mn-MN' },

  // Burmese - Myanmar
  { name: 'မြန်မာစာ', code: 'my-MM' },

  // Norwegian Bokmål - Norway
  { name: 'Norsk bokmål', code: 'nb' },

  // Nepali - Nepal and India
  { name: 'नेपाली', code: 'ne' },

  // Dutch - Netherlands
  { name: 'Nederlands', code: 'nl-NL' },

  // Dutch - Belgium (Flemish)
  { name: 'Nederlands (België)', code: 'nl-BE' },

  // Norwegian Nynorsk - Norway
  { name: 'Nynorsk', code: 'nn-NO' },

  // Occitan - Southern France, Monaco, Italy
  { name: 'Occitan', code: 'oc' },

  // Punjabi - Punjab (India and Pakistan)
  { name: 'ਪੰਜਾਬੀ', code: 'pa' },

  // Polish - Poland
  { name: 'Polski', code: 'pl-PL' },

  // Portuguese - Portugal
  { name: 'Português', code: 'pt-PT' },

  // Portuguese - Brazil
  { name: 'Português (Brasil)', code: 'pt-BR' },

  // Romanian - Romania
  { name: 'Română', code: 'ro-RO' },

  // Russian - Russia
  { name: 'Русский язык', code: 'ru-RU' },

  // Northern Sami - Northern Scandinavia
  { name: 'Davvisámegiella', code: 'se' },

  // // Sindhi - Pakistan and India
  // { name: 'سنڌي', code: 'sd' }, // Disabled because RTL

  // Sinhala - Sri Lanka
  { name: 'සිංහල', code: 'si-LK' },

  // Slovak - Slovakia
  { name: 'Slovenský jazyk', code: 'sk-SK' },

  // Slovenian - Slovenia
  { name: 'Slovenski jezik', code: 'sl-SI' },

  // Albanian - Albania, Kosovo
  { name: 'Shqip', code: 'sq' },

  // Serbian - Serbia (Default)
  { name: 'Српски', code: 'sr' },

  // Serbian - Serbia (Cyrillic script)
  { name: 'Српски (ћирилица)', code: 'sr-Cyrl' },

  // Swati - Eswatini (Swaziland)
  { name: 'SiSwati', code: 'ss' },

  // Swahili - East Africa
  { name: 'Kiswahili', code: 'sw' },

  // Swedish - Sweden
  { name: 'Svenska', code: 'sv' },

  // Tamil - Tamil Nadu (India), Sri Lanka, Singapore
  { name: 'தமிழ்', code: 'ta' },

  // Telugu - Andhra Pradesh, Telangana (India)
  { name: 'తెలుగు', code: 'te' },

  // Tetum - East Timor
  { name: 'Tetun', code: 'tet' },

  // Tajik - Tajikistan
  { name: 'Тоҷикӣ', code: 'tg' },

  // Thai - Thailand
  { name: 'ภาษาไทย', code: 'th-TH' },

  // Turkmen - Turkmenistan
  { name: 'Türkmen dili', code: 'tk-TM' },

  // Tagalog - Philippines
  { name: 'Wikang Tagalog', code: 'tl-PH' },

  // Klingon - Constructed Language (Star Trek)
  { name: 'tlhIngan Hol', code: 'tlh' },

  // Turkish - Turkey
  { name: 'Türkçe', code: 'tr-TR' },

  // Talossan - Constructed Language
  { name: 'Talossan', code: 'tzl' },

  // Tamazight (Tifinagh script) - North Africa
  { name: 'ⵜⴰⵎⴰⵣⵉⵖⵜ', code: 'tzm' },

  // Tamazight (Latin script) - North Africa
  { name: 'Tamazight', code: 'tzm-Latn' },

  // // Uyghur - Xinjiang (China)
  // { name: 'ئۇيغۇرچە', code: 'ug-CN' }, // Disabled because RTL

  // Ukrainian - Ukraine
  { name: 'Українська мова', code: 'uk-UA' },

  // // Urdu - Pakistan and India
  // { name: 'اردو', code: 'ur-PK' }, // Disabled because RTL

  // Uzbek - Uzbekistan (Cyrillic script)
  { name: 'Ўзбек тили', code: 'uz-UZ' },

  // Uzbek - Uzbekistan (Latin script)
  { name: "O'zbek tili", code: 'uz-Latn' },

  // Vietnamese - Vietnam
  { name: 'Tiếng Việt', code: 'vi-VN' },

  // Chinese - China
  { name: '中文', code: 'zh-CN' },

  // Chinese - Simplified
  { name: '简体中文', code: 'zh-Hans' },

  // Chinese - Traditional
  { name: '繁體中文', code: 'zh-Hant' },

  // Chinese - Hong Kong
  { name: '中文 (香港)', code: 'zh-HK' },

  // Chinese - Taiwan
  { name: '正體中文 (台灣)', code: 'zh-TW' },

  // Chinese - Macau
  { name: '中文 (澳門)', code: 'zh-MO' },

  // Yoruba - Nigeria, Benin, Togo
  { name: 'Yorùbá', code: 'yo' },
];

export const REGION_FORMAT_CODES: string[] = [
  'cs', // Czech
  'de', // German
  'de-AT', // Austrian German
  'de-BE', // German (Belgium)
  'de-CH', // Swiss High German
  'de-LI', // German (Liechtenstein)
  'de-LU', // German (Luxembourg)
  'en-AG', // English (Antigua & Barbuda)
  'en-AI', // English (Anguilla)
  'en-AS', // English (American Samoa)
  'en-AU', // Australian English
  'en-BB', // English (Barbados)
  'en-BM', // English (Bermuda)
  'en-BS', // English (Bahamas)
  'en-BW', // English (Botswana)
  'en-BZ', // English (Belize)
  'en-CA', // Canadian English
  'en-CC', // English (Cocos [Keeling] Islands)
  'en-CK', // English (Cook Islands)
  'en-CM', // English (Cameroon)
  'en-CX', // English (Christmas Island)
  'en-DG', // English (Diego Garcia)
  'en-DM', // English (Dominica)
  'en-ER', // English (Eritrea)
  'en-FJ', // English (Fiji)
  'en-FK', // English (Falkland Islands)
  'en-FM', // English (Micronesia)
  'en-GB', // British English
  'en-GD', // English (Grenada)
  'en-GG', // English (Guernsey)
  'en-GH', // English (Ghana)
  'en-GI', // English (Gibraltar)
  'en-GM', // English (Gambia)
  'en-GS', // English (South Georgia & South Sandwich Islands)
  'en-GU', // English (Guam)
  'en-GY', // English (Guyana)
  'en-HK', // English (Hong Kong SAR China)
  'en-IE', // English (Ireland)
  'en-IM', // English (Isle of Man)
  'en-IN', // English (India)
  'en-IO', // English (British Indian Ocean Territory)
  'en-JE', // English (Jersey)
  'en-JM', // English (Jamaica)
  'en-KE', // English (Kenya)
  'en-KI', // English (Kiribati)
  'en-KN', // English (St. Kitts & Nevis)
  'en-KY', // English (Cayman Islands)
  'en-LC', // English (St. Lucia)
  'en-LR', // English (Liberia)
  'en-LS', // English (Lesotho)
  'en-MG', // English (Madagascar)
  'en-MH', // English (Marshall Islands)
  'en-MP', // English (Northern Mariana Islands)
  'en-MS', // English (Montserrat)
  'en-MT', // English (Malta)
  'en-MU', // English (Mauritius)
  'en-MW', // English (Malawi)
  'en-NF', // English (Norfolk Island)
  'en-NG', // English (Nigeria)
  'en-NR', // English (Nauru)
  'en-NU', // English (Niue)
  'en-NZ', // English (New Zealand)
  'en-PG', // English (Papua New Guinea)
  'en-PH', // English (Philippines)
  'en-PK', // English (Pakistan)
  'en-PN', // English (Pitcairn Islands)
  'en-PR', // English (Puerto Rico)
  'en-RW', // English (Rwanda)
  'en-SB', // English (Solomon Islands)
  'en-SC', // English (Seychelles)
  'en-SD', // English (Sudan)
  'en-SG', // English (Singapore)
  'en-SH', // English (St. Helena)
  'en-SL', // English (Sierra Leone)
  'en-SS', // English (South Sudan)
  'en-SX', // English (Sint Maarten)
  'en-SZ', // English (Eswatini)
  'en-TC', // English (Turks & Caicos Islands)
  'en-TK', // English (Tokelau)
  'en-TO', // English (Tonga)
  'en-TT', // English (Trinidad & Tobago)
  'en-TZ', // English (Tanzania)
  'en-UM', // English (U.S. Outlying Islands)
  'en-VC', // English (St. Vincent & Grenadines)
  'en-VG', // English (British Virgin Islands)
  'en-VI', // English (U.S. Virgin Islands)
  'en-VU', // English (Vanuatu)
  'en-ZA', // English (South Africa)
  'en-ZM', // English (Zambia)
  'en-ZW', // English (Zimbabwe)
  'es', // Spanish
  'es-AR', // Spanish (Argentina)
  'es-BO', // Spanish (Bolivia)
  'es-CL', // Spanish (Chile)
  'es-CO', // Spanish (Colombia)
  'es-CR', // Spanish (Costa Rica)
  'es-CU', // Spanish (Cuba)
  'es-DO', // Spanish (Dominican Republic)
  'es-EA', // Spanish (Ceuta & Melilla)
  'es-EC', // Spanish (Ecuador)
  'es-GQ', // Spanish (Equatorial Guinea)
  'es-GT', // Spanish (Guatemala)
  'es-HN', // Spanish (Honduras)
  'es-IC', // Spanish (Canary Islands)
  'es-MX', // Mexican Spanish
  'es-NI', // Spanish (Nicaragua)
  'es-PA', // Spanish (Panama)
  'es-PE', // Spanish (Peru)
  'es-PR', // Spanish (Puerto Rico)
  'es-SV', // Spanish (El Salvador)
  'es-UY', // Spanish (Uruguay)
  'es-VE', // Spanish (Venezuela)
  'fr', // French
  'fr-BE', // French (Belgium)
  'fr-BF', // French (Burkina Faso)
  'fr-BI', // French (Burundi)
  'fr-BJ', // French (Benin)
  'fr-BL', // French (St. Barthélemy)
  'fr-CA', // Canadian French
  'fr-CD', // French (Congo - Kinshasa)
  'fr-CF', // French (Central African Republic)
  'fr-CG', // French (Congo - Brazzaville)
  'fr-CH', // Swiss French
  'fr-CI', // French (Côte d’Ivoire)
  'fr-CM', // French (Cameroon)
  'fr-DJ', // French (Djibouti)
  'fr-DZ', // French (Algeria)
  'fr-GA', // French (Gabon)
  'fr-GF', // French (French Guiana)
  'fr-GN', // French (Guinea)
  'fr-GP', // French (Guadeloupe)
  'fr-GQ', // French (Equatorial Guinea)
  'fr-HT', // French (Haiti)
  'fr-KM', // French (Comoros)
  'fr-LU', // French (Luxembourg)
  'fr-MA', // French (Morocco)
  'fr-MC', // French (Monaco)
  'fr-MF', // French (St. Martin)
  'fr-MG', // French (Madagascar)
  'fr-ML', // French (Mali)
  'fr-MQ', // French (Martinique)
  'fr-MU', // French (Mauritius)
  'fr-NC', // French (New Caledonia)
  'fr-PF', // French (French Polynesia)
  'fr-PM', // French (St. Pierre & Miquelon)
  'fr-RE', // French (Réunion)
  'fr-SC', // French (Seychelles)
  'fr-SN', // French (Senegal)
  'fr-TG', // French (Togo)
  'fr-TN', // French (Tunisia)
  'fr-VU', // French (Vanuatu)
  'fr-WF', // French (Wallis & Futuna)
  'fr-YT', // French (Mayotte)
  'hu', // Hungarian
  'id', // Indonesian
  'it', // Italian
  'it-CH', // Italian (Switzerland)
  'it-SM', // Italian (San Marino)
  'it-VA', // Italian (Vatican City)
  'ja', // Japanese
  'ko', // Korean
  'ko-KP', // Korean (North Korea)
  'nl', // Dutch
  'nl-AW', // Dutch (Aruba)
  'nl-BE', // Flemish
  'nl-SR', // Dutch (Suriname)
  'pl', // Polish
  'pt', // Portuguese
  'pt-AO', // Portuguese (Angola)
  'pt-CV', // Portuguese (Cape Verde)
  'pt-GW', // Portuguese (Guinea-Bissau)
  'pt-MZ', // Portuguese (Mozambique)
  'pt-PT', // European Portuguese
  'pt-ST', // Portuguese (São Tomé & Príncipe)
  'pt-TL', // Portuguese (Timor-Leste)
  'ru', // Russian
  'ru-KG', // Russian (Kyrgyzstan)
  'ru-KZ', // Russian (Kazakhstan)
  'ru-UA', // Russian (Ukraine)
  'sv', // Swedish
  'sv-AX', // Swedish (Åland Islands)
  'sv-FI', // Swedish (Finland)
  'tr', // Turkish
  'tr-CY', // Turkish (Cyprus)
  'zh-Hans', // Simplified Chinese
  'zh-Hans-HK', // Chinese (Simplified, Hong Kong SAR China)
  'zh-Hans-MO', // Chinese (Simplified, Macao SAR China)
  'zh-Hans-MY', // Chinese (Simplified, Malaysia)
  'zh-Hans-SG', // Chinese (Simplified, Singapore)
  'zh-Hant', // Traditional Chinese
  'zh-Hant-HK', // Chinese (Traditional, Hong Kong SAR China)
  'zh-Hant-MO', // Chinese (Traditional, Macao SAR China)
  'zh-Hant-MY', // Chinese (Traditional, Malaysia)
];
