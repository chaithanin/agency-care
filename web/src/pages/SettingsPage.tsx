import { useAuth } from '../auth/AuthContext';
import { Link } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Stack,
} from '@mui/material';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import DevicesOtherRoundedIcon from '@mui/icons-material/DevicesOtherRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import LeaderboardRoundedIcon from '@mui/icons-material/LeaderboardRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';

interface SettingsCard {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  desc: string;
  href: string;
}

function SettingCard({ icon, iconBg, title, desc, href }: SettingsCard) {
  return (
    <Paper
      component={Link}
      to={href}
      elevation={2}
      sx={{
        borderRadius: 3,
        p: 2.5,
        cursor: 'pointer',
        transition: 'all 0.2s',
        textDecoration: 'none',
        display: 'block',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 6,
        },
      }}
    >
      <Stack direction="row" alignItems="center" spacing={2}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2.5,
            bgcolor: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: '#fff',
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body1" fontWeight={700} noWrap>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4 }}>
            {desc}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = ['manager', 'super_admin', 'admin'].includes(user?.activeRole ?? '');
  const isCloser = user?.activeRole === 'closer';

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1.5} mb={0.5}>
        <SettingsRoundedIcon sx={{ fontSize: 30, color: 'text.secondary' }} />
        <Typography variant="h5" fontWeight={700}>
          Settings
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" mb={4}>
        System Configuration & Management
      </Typography>

      {/* GROUP 1: Team & Users */}
      {isAdmin && (
        <Box mb={4}>
          <Typography variant="overline" color="text.secondary" mb={1.5} display="block">
            Team & Users
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <SettingCard
                icon={<GroupsRoundedIcon />}
                iconBg="#1976d2"
                title="Employees"
                desc="Manage sales team, holidays, LINE setup"
                href="/employees"
              />
            </Grid>
            {(['manager', 'super_admin', 'admin'].includes(user?.activeRole ?? '')) && (
              <Grid item xs={12} sm={6} md={4}>
                <SettingCard
                  icon={<ManageAccountsRoundedIcon />}
                  iconBg="#7b1fa2"
                  title="Users & Access"
                  desc="User accounts, roles, passwords"
                  href="/users"
                />
              </Grid>
            )}
          </Grid>
        </Box>
      )}

      {/* GROUP 2: Master Data */}
      {(isAdmin || isCloser) && (
        <Box mb={4}>
          <Typography variant="overline" color="text.secondary" mb={1.5} display="block">
            Master Data
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <SettingCard
                icon={<Inventory2RoundedIcon />}
                iconBg="#388e3c"
                title="Products"
                desc="Product master list for sales recording"
                href="/products"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <SettingCard
                icon={<CampaignRoundedIcon />}
                iconBg="#f57c00"
                title="POSM Materials"
                desc="Promotional materials inventory"
                href="/posm"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <SettingCard
                icon={<DevicesOtherRoundedIcon />}
                iconBg="#00796b"
                title="Equipment"
                desc="Display models and equipment tracking"
                href="/models"
              />
            </Grid>
          </Grid>
        </Box>
      )}

      {/* GROUP 3: Planning Tools */}
      <Box mb={4}>
        <Typography variant="overline" color="text.secondary" mb={1.5} display="block">
          Planning Tools
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={4}>
            <SettingCard
              icon={<CalendarMonthRoundedIcon />}
              iconBg="#d32f2f"
              title="Calendar"
              desc="Monthly visit calendar view"
              href="/calendar"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <SettingCard
              icon={<ScheduleRoundedIcon />}
              iconBg="#303f9f"
              title="Scheduling"
              desc="Team targets, coverage, office planner"
              href="/scheduling"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <SettingCard
              icon={<LeaderboardRoundedIcon />}
              iconBg="#f9a825"
              title="Seller Performance"
              desc="Individual performance dashboard"
              href="/seller-performance"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <SettingCard
              icon={<AccountTreeRoundedIcon />}
              iconBg="#0097a7"
              title="Pipeline"
              desc="Agency pipeline funnel overview"
              href="/pipeline"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <SettingCard
              icon={<RouteRoundedIcon />}
              iconBg="#616161"
              title="Route Optimization"
              desc="Optimized daily visit route"
              href="/route"
            />
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
