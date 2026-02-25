package cronjob

import (
	"context"
	"log"
	"time"

	"github.com/robfig/cron/v3"
)

type OverdueRunner interface {
	RunOverdueNotification(ctx context.Context) (int, error)
}

func Start(runner OverdueRunner) (*cron.Cron, error) {
	loc, err := time.LoadLocation("Asia/Tokyo")
	if err != nil {
		return nil, err
	}
	c := cron.New(cron.WithLocation(loc), cron.WithSeconds())

	_, err = c.AddFunc("0 0 6 * * *", func() {
		sent, runErr := runner.RunOverdueNotification(context.Background())
		if runErr != nil {
			log.Printf("cron overdue notification failed: %v", runErr)
			return
		}
		log.Printf("cron overdue notification done: sent=%d", sent)
	})
	if err != nil {
		return nil, err
	}

	c.Start()
	return c, nil
}
