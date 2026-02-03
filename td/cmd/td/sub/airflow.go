package sub

import (
	"github.com/spf13/cobra"
)

func AirflowCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "airflow",
		Short: "Airflow operations via Tundra Dome",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runExternal(tdDsmScript(), append([]string{"airflow"}, args...)...)
		},
	}
}
