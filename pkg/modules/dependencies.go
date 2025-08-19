package modules

const (
	// All includes all modules necessary for Grafana to run as a standalone server
	All string = "all"

	Core                    string = "core"
	MemberlistKV            string = "memberlistkv"
	GrafanaAPIServer        string = "grafana-apiserver"
	SearchServer            string = "search-server"
	SearchServerRing        string = "search-server-ring"
	SearchServerDistributor string = "search-server-distributor"
	StorageServer           string = "storage-server"
	ZanzanaServer           string = "zanzana-server"
	InstrumentationServer   string = "instrumentation-server"
	FrontendServer          string = "frontend-server"
)

var dependencyMap = map[string][]string{
	MemberlistKV:            {InstrumentationServer},
	GrafanaAPIServer:        {InstrumentationServer},
	SearchServer:            {InstrumentationServer, SearchServerRing},
	SearchServerRing:        {InstrumentationServer, MemberlistKV},
	SearchServerDistributor: {InstrumentationServer, MemberlistKV, SearchServerRing},
	StorageServer:           {InstrumentationServer, SearchServerRing},
	ZanzanaServer:           {InstrumentationServer},
	Core:                    {},
	All:                     {Core},
	FrontendServer:          {},
}
