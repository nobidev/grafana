package server

import (
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
)

func (ms *ModuleServer) initSearchServer() (services.Service, error) {
	docBuilders, err := InitializeDocumentBuilders(ms.cfg)
	if err != nil {
		return nil, err
	}
	return sql.ProvideUnifiedSearchGrpcService(ms.cfg, ms.features, nil, ms.log, ms.registerer, docBuilders, ms.storageMetrics, ms.indexMetrics, ms.searchServerRing, ms.MemberlistKVConfig)
}
